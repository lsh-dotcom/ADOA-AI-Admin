import { createAdminClient } from "@/lib/supabase/admin";
import { NotificationService } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

// POST /api/payments/[id]/confirm - 입금 확인
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { paid_date, paid_amount } = await request.json();

  if (!paid_date || !paid_amount) {
    return NextResponse.json(
      { error: "입금일과 입금액을 입력해주세요." },
      { status: 400 }
    );
  }

  // 현재 결제 정보 조회
  const { data: payment, error: fetchErr } = await supabase
    .from("payments")
    .select("*, contracts(id, project_name, clients(company_name))")
    .eq("id", params.id)
    .single();

  if (fetchErr || !payment) {
    return NextResponse.json(
      { error: "정산 건을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 상태 업데이트
  const { data, error } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_date,
      paid_amount: parseInt(paid_amount),
      overdue_days: 0,
    })
    .eq("id", params.id)
    .select("*, contracts(id, project_name, clients(company_name))")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 해당 계약의 프리랜서 투입 건 → 'client_paid'로 자동 변경
  const contracts = payment.contracts as { id?: string; project_name?: string; clients?: { company_name?: string } } | null;
  const contractId = contracts?.id;

  if (contractId) {
    const { data: assignments } = await supabase
      .from("freelancer_assignments")
      .select("id, freelancers(name)")
      .eq("contract_id", contractId)
      .eq("payment_status", "pending");

    if (assignments && assignments.length > 0) {
      // 상태 일괄 변경
      await supabase
        .from("freelancer_assignments")
        .update({ payment_status: "client_paid" })
        .eq("contract_id", contractId)
        .eq("payment_status", "pending");

      // CEO에게 알림
      const notifier = new NotificationService(supabase);
      const projectName = contracts?.project_name || "";
      const clientName = contracts?.clients?.company_name || "";

      // 프리랜서 목록 텍스트
      const freelancerNames = assignments
        .map((a: Record<string, unknown>) => {
          const f = a.freelancers as { name?: string } | null;
          return f?.name || "알 수 없음";
        })
        .join(", ");

      await notifier.notify({
        type: "freelancer_payment_approval",
        title: "프리랜서 지급 승인 요청",
        message: `[${clientName}] ${projectName} 대금 입금 확인.\n프리랜서 ${assignments.length}명(${freelancerNames}) 지급 승인이 필요합니다.`,
        severity: "warning",
        target_role: "ceo",
        related_contract_id: contractId,
        related_payment_id: params.id,
      });
    }
  }

  return NextResponse.json(data);
}
