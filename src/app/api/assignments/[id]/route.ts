import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/assignments/[id] - 투입 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const body = await request.json();

  // 금액 재계산이 필요한 경우
  if (body.work_days !== undefined || body.daily_rate !== undefined) {
    const { data: current } = await supabase
      .from("freelancer_assignments")
      .select("work_days, daily_rate")
      .eq("id", params.id)
      .single();

    const workDays = body.work_days ?? current?.work_days ?? 0;
    const dailyRate = body.daily_rate ?? current?.daily_rate ?? 0;
    const totalFee = workDays * dailyRate;
    body.total_fee = totalFee;
    body.withholding_tax = Math.round(totalFee * 0.033);
    body.net_payment = totalFee - body.withholding_tax;
  }

  const { data, error } = await supabase
    .from("freelancer_assignments")
    .update(body)
    .eq("id", params.id)
    .select("*, freelancers(name, specialty)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/assignments/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("freelancer_assignments")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
