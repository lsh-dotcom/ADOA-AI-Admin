"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
import { formatKRW } from "@/lib/format";

// ── Agent definitions ──
const AGENTS = [
  { id: "contract", name: "계약 관리", color: "#D85A30", role: "계약서/입찰/견적", href: "/contracts", emoji: "📋", gridCol: 1, gridRow: 1 },
  { id: "billing", name: "정산 관리", color: "#1D9E75", role: "세금계산서/청구/입금/미수금", href: "/billing", emoji: "💰", gridCol: 3, gridRow: 1 },
  { id: "freelancer", name: "외부인건비", color: "#7F77DD", role: "외주투입/3.3%/Sheets", href: "/freelancers", emoji: "👷", gridCol: 5, gridRow: 1 },
  { id: "hr", name: "인사 관리", color: "#D4537E", role: "직원/근태/연차/제증명", href: "/hr", emoji: "👤", gridCol: 2, gridRow: 2 },
  { id: "cert", name: "인증서 관리", color: "#378ADD", role: "만료일/갱신알림", href: "/settings", emoji: "🔐", gridCol: 4, gridRow: 2 },
  { id: "company", name: "기업정보", color: "#888780", role: "연혁/실적/기업현황", href: "/settings", emoji: "🏢", gridCol: 1, gridRow: 3 },
  { id: "subsidy", name: "고용지원금", color: "#639922", role: "인턴십/지원금/메일모니터링", href: "/settings", emoji: "💼", gridCol: 3, gridRow: 3 },
] as const;

type AgentState = "idle" | "working" | "debating";

type AgentActivity = {
  agentId: string;
  state: AgentState;
  message: string;
};

type DashboardStats = {
  stats: {
    active_projects: number;
    monthly_revenue: number;
    total_unpaid: number;
    freelancer_payment_due: number;
  };
  recent_activity: Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    created_at: string;
  }>;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [tickerItems, setTickerItems] = useState<string[]>([
    "시스템이 시작되었습니다. AI 에이전트들이 대기 중입니다.",
  ]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (data.stats) {
        setStats(data);
        // Generate agent activities from dashboard data
        const newActivities: AgentActivity[] = [];
        const newTicker: string[] = [];

        if (data.today?.billing?.length > 0) {
          newActivities.push({ agentId: "billing", state: "working", message: `오늘 청구 ${data.today.billing.length}건 처리 중...` });
          newTicker.push(`정산 에이전트가 오늘 청구 ${data.today.billing.length}건을 확인했습니다.`);
        }
        if (data.today?.pending_approval?.length > 0) {
          newActivities.push({ agentId: "freelancer", state: "working", message: `지급 승인 ${data.today.pending_approval.length}건 대기` });
          newTicker.push(`외부인건비 에이전트가 프리랜서 지급 승인을 요청합니다.`);
        }
        if (data.today?.schedules?.length > 0) {
          newActivities.push({ agentId: "contract", state: "working", message: `오늘 마감 ${data.today.schedules.length}건` });
        }
        if (data.overdue?.length > 0) {
          newActivities.push({ agentId: "billing", state: "debating", message: `연체 ${data.overdue.length}건 독촉 필요` });
          newTicker.push(`정산 에이전트: 미수금 연체 ${data.overdue.length}건이 있습니다!`);
        }
        if (data.recent_activity?.length > 0) {
          data.recent_activity.slice(0, 3).forEach((n: { title: string }) => {
            newTicker.push(n.title);
          });
        }

        setActivities(newActivities);
        if (newTicker.length > 0) setTickerItems(newTicker);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useRealtimeSubscription("contracts", fetchDashboard);
  useRealtimeSubscription("payments", fetchDashboard);
  useRealtimeSubscription("notifications", fetchDashboard);

  // Ticker animation
  const [tickerIndex, setTickerIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerItems.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [tickerItems.length]);

  const getAgentActivity = (agentId: string) =>
    activities.find((a) => a.agentId === agentId);

  const selected = selectedAgent ? AGENTS.find((a) => a.id === selectedAgent) : null;
  const selectedActivity = selectedAgent ? getAgentActivity(selectedAgent) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI 오피스</h1>
          <p className="text-muted-foreground">ADOA 경영지원 AI 에이전트 현황</p>
        </div>
        <Link href="/chat">
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            업무 지시하기
          </button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Link href="/contracts" className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
            <p className="text-xs text-muted-foreground">진행 중 프로젝트</p>
            <p className="text-xl font-bold mt-1">{stats.stats.active_projects}건</p>
          </Link>
          <Link href="/billing" className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
            <p className="text-xs text-muted-foreground">이번 달 매출</p>
            <p className="text-xl font-bold mt-1">{formatKRW(stats.stats.monthly_revenue)}</p>
          </Link>
          <Link href="/billing" className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
            <p className="text-xs text-muted-foreground">미수금</p>
            <p className="text-xl font-bold mt-1">{formatKRW(stats.stats.total_unpaid)}</p>
          </Link>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">프리랜서 지급 예정</p>
            <p className="text-xl font-bold mt-1">{formatKRW(stats.stats.freelancer_payment_due)}</p>
          </div>
        </div>
      )}

      {/* Pixel Art Office */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Office ceiling / header */}
        <div className="h-3 bg-gradient-to-b from-[#2a2a3a] to-[#3a3a4a]" />

        {/* Office room */}
        <div className="relative bg-gradient-to-b from-[#f0ebe3] to-[#e8e0d4] dark:from-[#1e1e2e] dark:to-[#181825] p-4 md:p-6">
          {/* Wall decorations */}
          <div className="absolute top-3 left-6 w-16 h-10 rounded border-2 border-amber-700/30 bg-amber-100/50 dark:bg-amber-900/20" title="액자" />
          <div className="absolute top-3 right-6 w-12 h-8 rounded border-2 border-emerald-700/30 bg-emerald-100/50 dark:bg-emerald-900/20" title="시계" />

          {/* Agent Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 relative z-10">
            {AGENTS.map((agent) => {
              const activity = getAgentActivity(agent.id);
              const isSelected = selectedAgent === agent.id;
              const isWorking = activity?.state === "working";
              const isDebating = activity?.state === "debating";

              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
                  className={`relative group rounded-xl border-2 p-3 md:p-4 transition-all duration-300 text-left ${
                    isSelected
                      ? "border-primary shadow-lg scale-[1.02]"
                      : "border-transparent hover:border-border hover:shadow-md"
                  }`}
                  style={{ backgroundColor: `${agent.color}10` }}
                >
                  {/* Speech bubble */}
                  {activity && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
                      <div className="rounded-lg bg-background border px-2 py-1 text-[10px] shadow-md animate-bounce-subtle">
                        {activity.message}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-background border-r border-b" />
                      </div>
                    </div>
                  )}

                  {/* Desk */}
                  <div className="rounded-lg p-2 mb-2 relative" style={{ backgroundColor: `${agent.color}15` }}>
                    {/* Agent avatar */}
                    <div className="flex items-center justify-center">
                      <div
                        className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-2xl md:text-3xl shadow-inner transition-transform ${
                          isWorking ? "animate-bounce-subtle" : ""
                        } ${isDebating ? "animate-pulse" : ""}`}
                        style={{ backgroundColor: `${agent.color}25`, border: `2px solid ${agent.color}40` }}
                      >
                        {agent.emoji}
                      </div>
                    </div>

                    {/* Typing indicator for working */}
                    {isWorking && (
                      <div className="absolute bottom-1 right-1 flex gap-0.5">
                        <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: agent.color, animationDelay: "0ms" }} />
                        <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: agent.color, animationDelay: "150ms" }} />
                        <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: agent.color, animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>

                  {/* Name & role */}
                  <p className="text-xs font-bold truncate" style={{ color: agent.color }}>
                    {agent.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{agent.role}</p>

                  {/* Status dot */}
                  <div className="absolute top-2 right-2">
                    <span
                      className={`block w-2 h-2 rounded-full ${
                        isWorking ? "animate-pulse" : isDebating ? "animate-ping-slow" : ""
                      }`}
                      style={{
                        backgroundColor: isWorking || isDebating ? agent.color : "#9ca3af",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Floor tiles */}
        <div
          className="h-4"
          style={{
            background: "repeating-conic-gradient(#d4c5a9 0% 25%, #c9b898 0% 50%) 0 0 / 16px 16px",
          }}
        />
      </div>

      {/* Agent detail panel */}
      {selected && (
        <div
          className="rounded-xl border p-5 transition-all"
          style={{ borderColor: `${selected.color}40`, backgroundColor: `${selected.color}08` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: `${selected.color}20` }}
            >
              {selected.emoji}
            </div>
            <div>
              <h3 className="font-bold" style={{ color: selected.color }}>{selected.name}</h3>
              <p className="text-xs text-muted-foreground">{selected.role}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Link href={selected.href}>
                <button className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors" style={{ backgroundColor: selected.color }}>
                  관리 페이지
                </button>
              </Link>
              <Link href="/chat">
                <button className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                  업무 지시
                </button>
              </Link>
            </div>
          </div>
          <div className="text-sm">
            {selectedActivity ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: selected.color }} />
                <span>{selectedActivity.message}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">현재 대기 중입니다. 채팅에서 업무를 지시하세요.</p>
            )}
          </div>
        </div>
      )}

      {/* Activity ticker */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center">
          <div className="bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shrink-0">
            LIVE
          </div>
          <div className="flex-1 overflow-hidden px-3 py-2">
            <p className="text-sm animate-ticker whitespace-nowrap" key={tickerIndex}>
              {tickerItems[tickerIndex]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
