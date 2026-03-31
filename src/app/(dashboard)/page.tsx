"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileSignature,
  DollarSign,
  AlertTriangle,
  UserCheck,
  CalendarDays,
  Bell,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { formatKRW, formatDate } from "@/lib/format";
import { useRealtimeSubscription } from "@/hooks/use-realtime";

type DashboardData = {
  stats: {
    active_projects: number;
    monthly_revenue: number;
    total_unpaid: number;
    freelancer_payment_due: number;
  };
  today: {
    billing: Array<{
      id: string;
      amount: number;
      contracts: { project_name: string; clients: { company_name: string } | null } | null;
    }>;
    schedules: Array<{
      id: string;
      phase_name: string;
      contracts: { project_name: string } | null;
    }>;
    pending_approval: Array<{
      id: string;
      freelancers: { name: string } | null;
      contracts: { project_name: string } | null;
    }>;
  };
  overdue: Array<{
    id: string;
    total_with_vat: number;
    overdue_days: number;
    contracts: { project_name: string; clients: { company_name: string } | null } | null;
  }>;
  recent_activity: Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    created_at: string;
    is_read: boolean;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const d = await res.json();
      if (d.stats) setData(d);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Realtime subscriptions
  useRealtimeSubscription("contracts", fetchDashboard);
  useRealtimeSubscription("payments", fetchDashboard);
  useRealtimeSubscription("notifications", fetchDashboard);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const todayItems = [
    ...data.today.billing.map((b) => ({
      id: b.id,
      icon: DollarSign,
      text: `[청구] ${b.contracts?.clients?.company_name || ""} - ${b.contracts?.project_name || ""} ${formatKRW(b.amount)}`,
      href: "/billing",
    })),
    ...data.today.schedules.map((s) => ({
      id: s.id,
      icon: CalendarDays,
      text: `[마감] ${s.contracts?.project_name || ""} - ${s.phase_name || ""}`,
      href: "/schedules",
    })),
    ...data.today.pending_approval.map((a) => ({
      id: a.id,
      icon: CheckCircle2,
      text: `[승인대기] ${a.contracts?.project_name || ""} - ${a.freelancers?.name || ""} 지급 승인`,
      href: "/contracts",
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">ADOA 경영지원 시스템 현황</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/contracts" className="rounded-lg border bg-card p-6 shadow-sm hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">진행 중 프로젝트</h3>
            <FileSignature className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{data.stats.active_projects}건</p>
        </Link>
        <Link href="/billing" className="rounded-lg border bg-card p-6 shadow-sm hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">이번 달 매출</h3>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{formatKRW(data.stats.monthly_revenue)}</p>
          <p className="mt-1 text-xs text-muted-foreground">입금 확인 기준</p>
        </Link>
        <Link href="/billing" className="rounded-lg border bg-card p-6 shadow-sm hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">미수금 총액</h3>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{formatKRW(data.stats.total_unpaid)}</p>
          {data.overdue.length > 0 && (
            <p className="mt-1 text-xs text-red-500">연체 {data.overdue.length}건</p>
          )}
        </Link>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">프리랜서 지급 예정</h3>
            <UserCheck className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{formatKRW(data.stats.freelancer_payment_due)}</p>
          <p className="mt-1 text-xs text-muted-foreground">승인 대기 포함</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 오늘 할 일 */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">오늘 할 일</h2>
            {todayItems.length > 0 && (
              <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {todayItems.length}
              </span>
            )}
          </div>
          {todayItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">오늘 처리할 항목이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {todayItems.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex items-start gap-2 rounded-md p-2 hover:bg-muted transition-colors text-sm">
                    <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{item.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 연체 현황 */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold">미수금 연체 현황</h2>
          </div>
          {data.overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">D+7 이상 연체 건이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {data.overdue.map((item) => {
                let color = "text-yellow-600";
                if (item.overdue_days >= 30) color = "text-red-600";
                else if (item.overdue_days >= 14) color = "text-orange-600";
                return (
                  <li key={item.id} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted">
                    <div>
                      <p className="font-medium">{item.contracts?.clients?.company_name} - {item.contracts?.project_name}</p>
                      <p className="text-xs text-muted-foreground">{formatKRW(item.total_with_vat)}</p>
                    </div>
                    <span className={`font-bold ${color}`}>D+{item.overdue_days}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 최근 활동 */}
        <div className="rounded-lg border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">최근 알림</h2>
          </div>
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">최근 알림이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {data.recent_activity.slice(0, 8).map((n) => (
                <li key={n.id} className={`flex items-start gap-3 text-sm p-2 rounded-md ${!n.is_read ? "bg-muted/50" : ""}`}>
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    n.severity === "urgent" ? "bg-red-500" : n.severity === "warning" ? "bg-yellow-500" : n.severity === "success" ? "bg-green-500" : "bg-blue-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground truncate">{n.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
