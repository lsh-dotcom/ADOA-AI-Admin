"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
import { formatKRW } from "@/lib/format";

// ── Agent definitions ──
const AGENTS = [
  { id: "contract", name: "계약 관리", color: "#D85A30", role: "계약서/입찰/견적", href: "/contracts", skin: "#FFD5B8", hair: "#5C3317" },
  { id: "billing", name: "정산 관리", color: "#1D9E75", role: "세금계산서/청구/입금", href: "/billing", skin: "#FFE0BD", hair: "#2C1810" },
  { id: "freelancer", name: "외부인건비", color: "#7F77DD", role: "외주투입/3.3%", href: "/freelancers", skin: "#FFDCB5", hair: "#1A1A2E" },
  { id: "hr", name: "인사 관리", color: "#D4537E", role: "직원/근태/연차", href: "/hr", skin: "#FFE8D6", hair: "#4A1942" },
  { id: "cert", name: "인증서 관리", color: "#378ADD", role: "만료일/갱신알림", href: "/settings", skin: "#FFD5B8", hair: "#333" },
  { id: "company", name: "기업정보", color: "#888780", role: "연혁/실적/현황", href: "/settings", skin: "#FFE0BD", hair: "#555" },
  { id: "subsidy", name: "고용지원금", color: "#639922", role: "인턴십/지원금", href: "/settings", skin: "#FFDCB5", hair: "#3D2B1F" },
] as const;

type AgentState = "idle" | "working" | "debating";
type AgentActivity = { agentId: string; state: AgentState; message: string };

type DashboardStats = {
  stats: { active_projects: number; monthly_revenue: number; total_unpaid: number; freelancer_payment_due: number };
  today?: { billing?: unknown[]; pending_approval?: unknown[]; schedules?: unknown[] };
  overdue?: unknown[];
  recent_activity?: Array<{ id: string; title: string; message: string; severity: string; created_at: string }>;
};

// ── Pixel Character Component ──
function PixelCharacter({ color, skin, hair, isWorking }: { color: string; skin: string; hair: string; isWorking: boolean }) {
  return (
    <div className={`relative ${isWorking ? "animate-bounce-subtle" : ""}`} style={{ width: 48, height: 56, imageRendering: "pixelated" }}>
      {/* Hair */}
      <div className="absolute" style={{ top: 0, left: 12, width: 24, height: 8, backgroundColor: hair, borderRadius: "4px 4px 0 0" }} />
      <div className="absolute" style={{ top: 4, left: 8, width: 32, height: 4, backgroundColor: hair }} />
      {/* Face */}
      <div className="absolute" style={{ top: 8, left: 12, width: 24, height: 16, backgroundColor: skin, borderRadius: 2 }} />
      {/* Eyes */}
      <div className="absolute" style={{ top: 14, left: 16, width: 4, height: 4, backgroundColor: "#222", borderRadius: 1 }} />
      <div className="absolute" style={{ top: 14, left: 28, width: 4, height: 4, backgroundColor: "#222", borderRadius: 1 }} />
      {/* Mouth */}
      <div className="absolute" style={{ top: 20, left: 20, width: 8, height: 2, backgroundColor: "#c97", borderRadius: 1 }} />
      {/* Body / shirt */}
      <div className="absolute" style={{ top: 24, left: 8, width: 32, height: 20, backgroundColor: color, borderRadius: "0 0 4px 4px" }} />
      {/* Collar */}
      <div className="absolute" style={{ top: 24, left: 18, width: 12, height: 4, backgroundColor: "white", opacity: 0.6 }} />
      {/* Arms */}
      <div className="absolute" style={{ top: 28, left: 2, width: 8, height: 12, backgroundColor: color, borderRadius: 2, transform: isWorking ? "rotate(-15deg)" : "none", transformOrigin: "top right", transition: "transform 0.3s" }} />
      <div className="absolute" style={{ top: 28, left: 38, width: 8, height: 12, backgroundColor: color, borderRadius: 2, transform: isWorking ? "rotate(15deg)" : "none", transformOrigin: "top left", transition: "transform 0.3s" }} />
      {/* Hands */}
      <div className="absolute" style={{ top: 38, left: 2, width: 6, height: 4, backgroundColor: skin, borderRadius: 1 }} />
      <div className="absolute" style={{ top: 38, left: 40, width: 6, height: 4, backgroundColor: skin, borderRadius: 1 }} />
      {/* Legs */}
      <div className="absolute" style={{ top: 44, left: 12, width: 10, height: 12, backgroundColor: "#3a3a4a", borderRadius: "0 0 2px 2px" }} />
      <div className="absolute" style={{ top: 44, left: 26, width: 10, height: 12, backgroundColor: "#3a3a4a", borderRadius: "0 0 2px 2px" }} />
    </div>
  );
}

// ── Desk Component ──
function PixelDesk() {
  return (
    <div className="relative" style={{ width: 64, height: 24 }}>
      {/* Desktop surface */}
      <div className="absolute" style={{ top: 0, left: 0, width: 64, height: 8, backgroundColor: "#a0815e", borderRadius: 2 }} />
      {/* Front panel */}
      <div className="absolute" style={{ top: 8, left: 4, width: 56, height: 16, backgroundColor: "#8b6e4e", borderRadius: "0 0 2px 2px" }} />
      {/* Monitor */}
      <div className="absolute" style={{ top: -16, left: 20, width: 24, height: 16, backgroundColor: "#333", borderRadius: 2, border: "2px solid #555" }} />
      {/* Screen glow */}
      <div className="absolute" style={{ top: -14, left: 22, width: 20, height: 12, backgroundColor: "#4488ff", opacity: 0.3, borderRadius: 1 }} />
    </div>
  );
}

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
        const acts: AgentActivity[] = [];
        const ticks: string[] = [];

        if (data.today?.billing?.length > 0) {
          acts.push({ agentId: "billing", state: "working", message: `청구 ${data.today.billing.length}건 처리 중...` });
          ticks.push(`정산 에이전트가 청구 ${data.today.billing.length}건을 확인했습니다.`);
        }
        if (data.today?.pending_approval?.length > 0) {
          acts.push({ agentId: "freelancer", state: "working", message: `지급 승인 ${data.today.pending_approval.length}건 대기` });
          ticks.push(`외부인건비 에이전트가 지급 승인을 요청합니다.`);
        }
        if (data.today?.schedules?.length > 0) {
          acts.push({ agentId: "contract", state: "working", message: `오늘 마감 ${data.today.schedules.length}건` });
        }
        if (data.overdue?.length > 0) {
          acts.push({ agentId: "billing", state: "debating", message: `미수금 ${data.overdue.length}건 독촉!` });
          ticks.push(`정산 에이전트: 미수금 연체 ${data.overdue.length}건!`);
        }
        if (data.recent_activity?.length > 0) {
          data.recent_activity.slice(0, 3).forEach((n: { title: string }) => ticks.push(n.title));
        }

        setActivities(acts);
        if (ticks.length > 0) setTickerItems(ticks);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useRealtimeSubscription("contracts", fetchDashboard);
  useRealtimeSubscription("payments", fetchDashboard);
  useRealtimeSubscription("notifications", fetchDashboard);

  const [tickerIndex, setTickerIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTickerIndex((p) => (p + 1) % tickerItems.length), 4000);
    return () => clearInterval(interval);
  }, [tickerItems.length]);

  const getActivity = (id: string) => activities.find((a) => a.agentId === id);
  const selected = selectedAgent ? AGENTS.find((a) => a.id === selectedAgent) : null;

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

      {/* ═══ PIXEL ART OFFICE ═══ */}
      <div className="rounded-xl border overflow-hidden select-none">
        {/* Ceiling */}
        <div className="h-2" style={{ background: "linear-gradient(180deg, #2a2a3a 0%, #444 100%)" }} />

        {/* Wall */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #e8dfd3 0%, #ddd4c4 50%, #d5c9b8 100%)", minHeight: 100 }}>
          {/* Wall decorations */}
          <div className="absolute top-2 left-4 w-14 h-9 border-2 rounded-sm" style={{ borderColor: "#b8a080", backgroundColor: "#f5e6d0" }}>
            <div className="w-full h-full flex items-center justify-center text-[8px] text-amber-800/50 font-bold">ADOA</div>
          </div>
          <div className="absolute top-2 right-4 w-10 h-10 rounded-full border-2" style={{ borderColor: "#999", backgroundColor: "#f0f0f0" }}>
            <div className="w-full h-full flex items-center justify-center text-[7px] font-mono text-gray-500">
              {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, "0")}
            </div>
          </div>
          {/* Window */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-12 rounded-sm border-2" style={{ borderColor: "#b0a090", backgroundColor: "#c8e8ff" }}>
            <div className="absolute bottom-0 left-0 right-0 h-3" style={{ backgroundColor: "#7ab864" }} />
          </div>
          <div className="h-8" />
        </div>

        {/* Desk area - where agents sit */}
        <div className="relative px-2 md:px-4 pb-2" style={{ backgroundColor: "#ddd4c4" }}>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 md:gap-2">
            {AGENTS.map((agent) => {
              const activity = getActivity(agent.id);
              const isSelected = selectedAgent === agent.id;
              const isWorking = activity?.state === "working";
              const isDebating = activity?.state === "debating";

              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
                  className={`relative flex flex-col items-center pt-2 pb-1 rounded transition-all ${
                    isSelected ? "bg-white/40 dark:bg-white/10 ring-2 ring-offset-0" : "hover:bg-white/20"
                  }`}
                  style={isSelected ? { outlineColor: agent.color } : undefined}
                >
                  {/* Speech bubble */}
                  {activity && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
                      <div className="rounded bg-white dark:bg-gray-800 border px-1.5 py-0.5 text-[8px] md:text-[9px] shadow-md font-medium" style={{ color: agent.color }}>
                        {activity.message}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 bg-white dark:bg-gray-800 border-r border-b" />
                      </div>
                    </div>
                  )}

                  {/* Character */}
                  <div className="scale-75 md:scale-90 origin-bottom">
                    <PixelCharacter color={agent.color} skin={agent.skin} hair={agent.hair} isWorking={isWorking || isDebating || false} />
                  </div>

                  {/* Status indicator */}
                  <div className="absolute top-1 right-1">
                    <span
                      className={`block w-1.5 h-1.5 rounded-full ${isWorking || isDebating ? "animate-pulse" : ""}`}
                      style={{ backgroundColor: isWorking || isDebating ? agent.color : "#bbb" }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desks row */}
          <div className="flex justify-around mt-0 px-2 opacity-80">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="hidden sm:block">
                <PixelDesk />
              </div>
            ))}
          </div>
        </div>

        {/* Floor tiles */}
        <div
          className="h-6"
          style={{
            background: `
              repeating-conic-gradient(#c4b594 0% 25%, #b8a884 0% 50%) 0 0 / 16px 16px
            `,
          }}
        />

        {/* Agent name bar */}
        <div className="flex flex-wrap justify-center gap-2 px-3 py-2 bg-card border-t">
          {AGENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(selectedAgent === a.id ? null : a.id)}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                selectedAgent === a.id ? "ring-1 shadow-sm" : "opacity-70 hover:opacity-100"
              }`}
              style={{ backgroundColor: `${a.color}18`, color: a.color, outlineColor: a.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.color }} />
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Agent detail panel */}
      {selected && (
        <div className="rounded-xl border p-5 transition-all" style={{ borderColor: `${selected.color}40`, backgroundColor: `${selected.color}08` }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="scale-75 origin-center">
              <PixelCharacter color={selected.color} skin={selected.skin} hair={selected.hair} isWorking={false} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold" style={{ color: selected.color }}>{selected.name}</h3>
              <p className="text-xs text-muted-foreground">{selected.role}</p>
            </div>
            <div className="flex gap-2">
              <Link href={selected.href}>
                <button className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: selected.color }}>관리 페이지</button>
              </Link>
              <Link href="/chat">
                <button className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted">업무 지시</button>
              </Link>
            </div>
          </div>
          <div className="text-sm">
            {getActivity(selected.id) ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: selected.color }} />
                <span>{getActivity(selected.id)!.message}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">대기 중 — 채팅에서 업무를 지시하세요.</p>
            )}
          </div>
        </div>
      )}

      {/* LIVE Activity ticker */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center">
          <div className="bg-red-500 px-3 py-2 text-[10px] font-black text-white shrink-0 tracking-wider animate-pulse">
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
