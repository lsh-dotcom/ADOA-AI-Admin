import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/assignments/tax-summary?period=2026H1
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const period = new URL(request.url).searchParams.get("period");

  // period: "2026H1" (1~6월) or "2026H2" (7~12월)
  let startDate: string;
  let endDate: string;

  if (period) {
    const year = parseInt(period.slice(0, 4));
    const half = period.slice(4);
    if (half === "H1") {
      startDate = `${year}-01-01`;
      endDate = `${year}-06-30`;
    } else {
      startDate = `${year}-07-01`;
      endDate = `${year}-12-31`;
    }
  } else {
    // 현재 반기
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    if (month <= 6) {
      startDate = `${year}-01-01`;
      endDate = `${year}-06-30`;
    } else {
      startDate = `${year}-07-01`;
      endDate = `${year}-12-31`;
    }
  }

  const { data, error } = await supabase
    .from("freelancer_assignments")
    .select("*, freelancers(name, specialty)")
    .eq("payment_status", "paid")
    .gte("paid_date", startDate)
    .lte("paid_date", endDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 프리랜서별 집계
  const byFreelancer: Record<string, {
    name: string;
    total_fee: number;
    withholding_tax: number;
    net_payment: number;
    count: number;
  }> = {};

  let grandTotalFee = 0;
  let grandWithholdingTax = 0;

  for (const a of data || []) {
    const fId = a.freelancer_id as string;
    const freelancers = a.freelancers as { name?: string } | null;
    if (!byFreelancer[fId]) {
      byFreelancer[fId] = {
        name: freelancers?.name || "알 수 없음",
        total_fee: 0,
        withholding_tax: 0,
        net_payment: 0,
        count: 0,
      };
    }
    const fee = Number(a.total_fee) || 0;
    const tax = Number(a.withholding_tax) || 0;
    const net = Number(a.net_payment) || 0;
    byFreelancer[fId].total_fee += fee;
    byFreelancer[fId].withholding_tax += tax;
    byFreelancer[fId].net_payment += net;
    byFreelancer[fId].count++;
    grandTotalFee += fee;
    grandWithholdingTax += tax;
  }

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    by_freelancer: Object.values(byFreelancer),
    totals: {
      total_fee: grandTotalFee,
      withholding_tax: grandWithholdingTax,
      net_payment: grandTotalFee - grandWithholdingTax,
      freelancer_count: Object.keys(byFreelancer).length,
    },
  });
}
