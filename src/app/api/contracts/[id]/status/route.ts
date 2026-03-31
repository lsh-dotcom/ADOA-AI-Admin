import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// POST /api/contracts/[id]/status - 계약 상태 변경
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { status: newStatus } = await request.json();

  // 현재 계약 조회
  const { data: contract, error: fetchError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchError || !contract) {
    return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
  }

  // 상태 전환 유효성 검사
  const validTransitions: Record<string, string[]> = {
    draft: ["sent_to_client"],
    sent_to_client: ["negotiating", "signed"],
    negotiating: ["signed", "draft"],
    signed: ["in_progress"],
    in_progress: ["delivered"],
    delivered: ["completed"],
  };

  const allowed = validTransitions[contract.status] || [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      {
        error: `'${contract.status}' 상태에서 '${newStatus}'(으)로 변경할 수 없습니다.`,
      },
      { status: 400 }
    );
  }

  // 상태 업데이트
  const { data: updated, error: updateError } = await supabase
    .from("contracts")
    .update({ status: newStatus })
    .eq("id", params.id)
    .select("*, clients(company_name, contact_name)")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 'signed' 상태로 변경 시 → 정산 레코드 + 일정 자동 생성
  if (newStatus === "signed") {
    await createPaymentRecords(supabase, contract);
    await generateSchedules(supabase, contract.id);
  }

  return NextResponse.json(updated);
}

async function createPaymentRecords(
  supabase: ReturnType<typeof createAdminClient>,
  contract: {
    id: string;
    total_amount: number;
    advance_amount: number | null;
    balance_amount: number | null;
    delivery_deadline: string | null;
  }
) {
  const today = new Date();
  const payments: Array<{
    contract_id: string;
    payment_type: string;
    amount: number;
    vat_amount: number;
    total_with_vat: number;
    invoice_date: string;
    due_date: string;
    status: string;
  }> = [];

  if (contract.advance_amount && contract.advance_amount > 0) {
    // 선금: 체결일 + 3일
    const advanceInvoiceDate = new Date(today);
    advanceInvoiceDate.setDate(advanceInvoiceDate.getDate() + 3);
    const advanceDueDate = new Date(advanceInvoiceDate);
    advanceDueDate.setDate(advanceDueDate.getDate() + 30);

    const advanceVat = Math.round(contract.advance_amount * 0.1);
    payments.push({
      contract_id: contract.id,
      payment_type: "advance",
      amount: contract.advance_amount,
      vat_amount: advanceVat,
      total_with_vat: contract.advance_amount + advanceVat,
      invoice_date: advanceInvoiceDate.toISOString().split("T")[0],
      due_date: advanceDueDate.toISOString().split("T")[0],
      status: "pending",
    });
  }

  if (contract.balance_amount && contract.balance_amount > 0) {
    // 잔금: delivery_deadline + 5일
    let balanceInvoiceDate: Date;
    if (contract.delivery_deadline) {
      balanceInvoiceDate = new Date(contract.delivery_deadline);
      balanceInvoiceDate.setDate(balanceInvoiceDate.getDate() + 5);
    } else {
      balanceInvoiceDate = new Date(today);
      balanceInvoiceDate.setDate(balanceInvoiceDate.getDate() + 60);
    }
    const balanceDueDate = new Date(balanceInvoiceDate);
    balanceDueDate.setDate(balanceDueDate.getDate() + 30);

    const balanceVat = Math.round(contract.balance_amount * 0.1);
    payments.push({
      contract_id: contract.id,
      payment_type: "balance",
      amount: contract.balance_amount,
      vat_amount: balanceVat,
      total_with_vat: contract.balance_amount + balanceVat,
      invoice_date: balanceInvoiceDate.toISOString().split("T")[0],
      due_date: balanceDueDate.toISOString().split("T")[0],
      status: "pending",
    });
  }

  // 300만원 미만: 전액 납품 후 결제
  if (payments.length === 0) {
    let invoiceDate: Date;
    if (contract.delivery_deadline) {
      invoiceDate = new Date(contract.delivery_deadline);
      invoiceDate.setDate(invoiceDate.getDate() + 5);
    } else {
      invoiceDate = new Date(today);
      invoiceDate.setDate(invoiceDate.getDate() + 60);
    }
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const vat = Math.round(contract.total_amount * 0.1);
    payments.push({
      contract_id: contract.id,
      payment_type: "balance",
      amount: contract.total_amount,
      vat_amount: vat,
      total_with_vat: contract.total_amount + vat,
      invoice_date: invoiceDate.toISOString().split("T")[0],
      due_date: dueDate.toISOString().split("T")[0],
      status: "pending",
    });
  }

  if (payments.length > 0) {
    await supabase.from("payments").insert(payments);
  }
}

const PHASES = [
  { phase: "kickoff", phase_name: "사전미팅", days: 1, offset: 3 },
  { phase: "planning", phase_name: "기획", days: 5, offset: 0 },
  { phase: "pre_production", phase_name: "촬영준비", days: 3, offset: 0 },
  { phase: "shooting", phase_name: "촬영", days: 2, offset: 0 },
  { phase: "editing", phase_name: "편집", days: 7, offset: 0 },
  { phase: "first_draft", phase_name: "1차 시안", days: 1, offset: 0 },
  { phase: "revision", phase_name: "피드백/수정", days: 8, offset: 0 },
  { phase: "final_delivery", phase_name: "최종 납품", days: 1, offset: 0 },
];

async function generateSchedules(
  supabase: ReturnType<typeof createAdminClient>,
  contractId: string
) {
  const { data: contract } = await supabase
    .from("contracts")
    .select("contract_start, contract_end, delivery_deadline")
    .eq("id", contractId)
    .single();

  if (!contract) return;

  const start = contract.contract_start
    ? new Date(contract.contract_start as string)
    : new Date();
  const deadline = (contract.delivery_deadline || contract.contract_end) as string | null;

  const totalTemplateDays = PHASES.reduce((s, p) => s + p.days + p.offset, 0);
  const totalAvailable = deadline
    ? Math.floor((new Date(deadline).getTime() - start.getTime()) / 86400000)
    : totalTemplateDays;
  const ratio = totalAvailable > 0 ? totalAvailable / totalTemplateDays : 1;

  const schedules = [];
  let cursor = new Date(start);

  for (const p of PHASES) {
    const off = Math.max(p.offset > 0 ? 1 : 0, Math.round(p.offset * ratio));
    const dur = Math.max(1, Math.round(p.days * ratio));

    if (p.offset > 0) cursor.setDate(cursor.getDate() + off);

    const s = new Date(cursor);
    const e = new Date(cursor);
    e.setDate(e.getDate() + dur - 1);

    schedules.push({
      contract_id: contractId,
      phase: p.phase,
      phase_name: p.phase_name,
      start_date: s.toISOString().split("T")[0],
      end_date: e.toISOString().split("T")[0],
      status: "pending",
    });

    cursor = new Date(e);
    cursor.setDate(cursor.getDate() + 1);
  }

  await supabase.from("project_schedules").insert(schedules);
}
