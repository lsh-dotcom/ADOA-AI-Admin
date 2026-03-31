import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// POST /api/assignments - 프리랜서 투입 등록
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const workDays = parseInt(body.work_days) || 0;
  const dailyRate = parseInt(body.daily_rate) || 0;
  const totalFee = workDays * dailyRate;
  const withholdingTax = Math.round(totalFee * 0.033);
  const netPayment = totalFee - withholdingTax;

  const { data, error } = await supabase
    .from("freelancer_assignments")
    .insert({
      contract_id: body.contract_id,
      freelancer_id: body.freelancer_id,
      work_days: workDays,
      daily_rate: dailyRate,
      total_fee: totalFee,
      withholding_tax: withholdingTax,
      net_payment: netPayment,
      payment_status: "pending",
      early_payment: body.early_payment || false,
      early_payment_reason: body.early_payment_reason || null,
    })
    .select("*, freelancers(name, specialty)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
