import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET /api/payments/summary - 정산 요약 통계
export async function GET() {
  const supabase = createAdminClient();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  // 이번 달 입금 확인된 금액
  const { data: paidThisMonth } = await supabase
    .from("payments")
    .select("total_with_vat")
    .in("status", ["paid", "confirmed"])
    .gte("paid_date", firstOfMonth)
    .lte("paid_date", lastOfMonth);

  const monthlyRevenue = (paidThisMonth || []).reduce(
    (sum: number, p: { total_with_vat: number | null }) =>
      sum + (p.total_with_vat || 0),
    0
  );

  // 미수금 총액 (미입금 상태)
  const { data: unpaid } = await supabase
    .from("payments")
    .select("total_with_vat")
    .in("status", ["pending", "invoiced", "tax_invoice_issued"]);

  const totalUnpaid = (unpaid || []).reduce(
    (sum: number, p: { total_with_vat: number | null }) =>
      sum + (p.total_with_vat || 0),
    0
  );

  // 이번 달 청구 예정 (이번 달 내 invoice_date)
  const { data: dueThisMonth } = await supabase
    .from("payments")
    .select("total_with_vat")
    .eq("status", "pending")
    .gte("invoice_date", firstOfMonth)
    .lte("invoice_date", lastOfMonth);

  const monthlyDue = (dueThisMonth || []).reduce(
    (sum: number, p: { total_with_vat: number | null }) =>
      sum + (p.total_with_vat || 0),
    0
  );

  // 세금계산서 발행 대기 (입금 확인됐으나 tax_invoice_date 없음)
  const { data: taxPending } = await supabase
    .from("payments")
    .select("id")
    .eq("status", "paid")
    .is("tax_invoice_date", null);

  // 연체 건수
  const { data: overdueItems } = await supabase
    .from("payments")
    .select("id")
    .in("status", ["pending", "invoiced", "tax_invoice_issued"])
    .lt("due_date", todayStr);

  return NextResponse.json({
    monthly_revenue: monthlyRevenue,
    total_unpaid: totalUnpaid,
    monthly_due: monthlyDue,
    tax_invoice_pending: (taxPending || []).length,
    overdue_count: (overdueItems || []).length,
  });
}
