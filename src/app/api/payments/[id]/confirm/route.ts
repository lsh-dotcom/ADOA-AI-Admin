import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("*, contracts(project_name)")
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
    .select("*, contracts(project_name, clients(company_name))")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
