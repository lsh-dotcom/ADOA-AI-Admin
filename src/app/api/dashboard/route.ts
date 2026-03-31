import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createAdminClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];

  // 1. 진행 중 프로젝트
  const { data: activeContracts } = await supabase
    .from("contracts")
    .select("id")
    .in("status", ["signed", "in_progress"]);

  // 2. 이번 달 매출
  const { data: paidThisMonth } = await supabase
    .from("payments")
    .select("total_with_vat")
    .in("status", ["paid", "confirmed"])
    .gte("paid_date", firstOfMonth)
    .lte("paid_date", lastOfMonth);

  const monthlyRevenue = (paidThisMonth || []).reduce(
    (s: number, p: { total_with_vat: number | null }) => s + (Number(p.total_with_vat) || 0), 0
  );

  // 3. 미수금
  const { data: unpaid } = await supabase
    .from("payments")
    .select("total_with_vat")
    .in("status", ["pending", "invoiced", "tax_invoice_issued"]);

  const totalUnpaid = (unpaid || []).reduce(
    (s: number, p: { total_with_vat: number | null }) => s + (Number(p.total_with_vat) || 0), 0
  );

  // 4. 이번 달 프리랜서 지급 예정
  const { data: freelancerDue } = await supabase
    .from("freelancer_assignments")
    .select("net_payment")
    .in("payment_status", ["client_paid", "approved"]);

  const freelancerPaymentDue = (freelancerDue || []).reduce(
    (s: number, a: { net_payment: number | null }) => s + (Number(a.net_payment) || 0), 0
  );

  // 5. 오늘 할 일
  // 오늘 청구 건
  const { data: todayBilling } = await supabase
    .from("payments")
    .select("id, amount, contracts(project_name, clients(company_name))")
    .eq("invoice_date", todayStr)
    .eq("status", "pending");

  // 오늘 마감 일정
  const { data: todaySchedules } = await supabase
    .from("project_schedules")
    .select("id, phase_name, contracts(project_name)")
    .eq("end_date", todayStr)
    .neq("status", "completed");

  // 승인 대기 (프리랜서 지급)
  const { data: pendingApproval } = await supabase
    .from("freelancer_assignments")
    .select("id, freelancers(name), contracts(project_name)")
    .eq("payment_status", "client_paid");

  // 6. 연체 현황 (D+7 이상)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: overdueItems } = await supabase
    .from("payments")
    .select("id, amount, total_with_vat, due_date, contracts(project_name, clients(company_name))")
    .in("status", ["pending", "invoiced", "tax_invoice_issued"])
    .lt("due_date", sevenDaysAgo.toISOString().split("T")[0]);

  // 연체일수 계산
  const overdueWithDays = (overdueItems || []).map((p: Record<string, unknown>) => {
    const due = new Date(p.due_date as string);
    const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return { ...p, overdue_days: days };
  });

  // 7. 최근 알림
  const { data: recentNotifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    stats: {
      active_projects: (activeContracts || []).length,
      monthly_revenue: monthlyRevenue,
      total_unpaid: totalUnpaid,
      freelancer_payment_due: freelancerPaymentDue,
    },
    today: {
      billing: todayBilling || [],
      schedules: todaySchedules || [],
      pending_approval: pendingApproval || [],
    },
    overdue: overdueWithDays,
    recent_activity: recentNotifications || [],
  });
}
