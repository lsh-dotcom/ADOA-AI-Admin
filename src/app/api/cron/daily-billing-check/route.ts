import { createAdminClient } from "@/lib/supabase/admin";
import { NotificationService, type NotificationPayload } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

// Vercel Cron: 매일 오전 9시 KST 실행
export async function GET(request: NextRequest) {
  // Vercel Cron 인증
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const notifier = new NotificationService(supabase);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const notifications: NotificationPayload[] = [];

  // 1. 오늘 청구일인 건 → PM에게 알림
  const { data: dueToday } = await supabase
    .from("payments")
    .select("*, contracts(project_name, clients(company_name))")
    .eq("invoice_date", todayStr)
    .eq("status", "pending");

  for (const p of dueToday || []) {
    const contracts = p.contracts as {
      project_name?: string;
      clients?: { company_name?: string };
    } | null;
    notifications.push({
      type: "billing_due_today",
      title: "오늘 청구 예정",
      message: `[${contracts?.clients?.company_name}] ${contracts?.project_name} - 청구일입니다. 청구서를 발송해주세요.`,
      severity: "info",
      target_role: "pm",
      related_payment_id: p.id as string,
      related_contract_id: p.contract_id as string,
    });
  }

  // 2-4. 연체 건 조회
  const { data: overdue } = await supabase
    .from("payments")
    .select("*, contracts(project_name, clients(company_name))")
    .in("status", ["pending", "invoiced", "tax_invoice_issued"])
    .lt("due_date", todayStr);

  for (const p of overdue || []) {
    const dueDate = new Date(p.due_date as string);
    const diffDays = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const contracts = p.contracts as {
      project_name?: string;
      clients?: { company_name?: string };
    } | null;
    const clientName = contracts?.clients?.company_name || "알 수 없음";
    const projectName = contracts?.project_name || "";

    // 연체일수 업데이트
    await supabase
      .from("payments")
      .update({ overdue_days: diffDays, reminder_sent: true })
      .eq("id", p.id as string);

    // D+7 → PM에게 "확인 부탁"
    if (diffDays === 7) {
      notifications.push({
        type: "overdue_7",
        title: "미입금 D+7 확인 요청",
        message: `[${clientName}] ${projectName} - 입금기한 7일 초과. 거래처에 입금 확인을 요청해주세요.`,
        severity: "warning",
        target_role: "pm",
        related_payment_id: p.id as string,
        related_contract_id: p.contract_id as string,
      });
    }

    // D+14 → PM에게 "독촉 필요"
    if (diffDays === 14) {
      notifications.push({
        type: "overdue_14",
        title: "미입금 D+14 독촉 필요",
        message: `[${clientName}] ${projectName} - 입금기한 14일 초과. 독촉이 필요합니다.`,
        severity: "warning",
        target_role: "pm",
        related_payment_id: p.id as string,
        related_contract_id: p.contract_id as string,
      });
    }

    // D+30 → CEO에게 "긴급"
    if (diffDays === 30) {
      const amount = Number(p.total_with_vat) || 0;
      notifications.push({
        type: "overdue_30",
        title: "⚠ 미수금 30일 초과",
        message: `[${clientName}] ${projectName} - 미수금 ${amount.toLocaleString()}원이 30일 초과되었습니다. 즉시 조치가 필요합니다.`,
        severity: "urgent",
        target_role: "ceo",
        related_payment_id: p.id as string,
        related_contract_id: p.contract_id as string,
      });
    }
  }

  // 5. D-3 세금계산서 발행 예정 알림
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const threeDaysStr = threeDaysLater.toISOString().split("T")[0];

  const { data: taxDueSoon } = await supabase
    .from("payments")
    .select("*, contracts(project_name, clients(company_name))")
    .eq("status", "paid")
    .is("tax_invoice_date", null)
    .lte("paid_date", threeDaysStr);

  for (const p of taxDueSoon || []) {
    const contracts = p.contracts as {
      project_name?: string;
      clients?: { company_name?: string };
    } | null;
    notifications.push({
      type: "tax_invoice_due",
      title: "세금계산서 발행 필요",
      message: `[${contracts?.clients?.company_name}] ${contracts?.project_name} - 입금 확인 후 3일 이내 세금계산서 발행이 필요합니다.`,
      severity: "info",
      target_role: "ceo",
      related_payment_id: p.id as string,
      related_contract_id: p.contract_id as string,
    });
  }

  // 알림 일괄 발송
  if (notifications.length > 0) {
    await notifier.notifyBatch(notifications);
  }

  return NextResponse.json({
    processed: true,
    notifications_sent: notifications.length,
    breakdown: {
      due_today: (dueToday || []).length,
      overdue: (overdue || []).length,
      tax_invoice_pending: (taxDueSoon || []).length,
    },
  });
}
