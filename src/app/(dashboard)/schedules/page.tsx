"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useRealtimeSubscription } from "@/hooks/use-realtime";

type Schedule = {
  id: string;
  contract_id: string;
  phase: string;
  phase_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  computed_status: string;
  assigned_to: string | null;
  contracts: {
    project_name: string;
    clients: { company_name: string } | null;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-300 dark:bg-gray-600",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  delayed: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  in_progress: "진행중",
  completed: "완료",
  delayed: "지연",
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewWeeks] = useState(6);
  const [startOffset, setStartOffset] = useState(0); // weeks offset from today

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedules");
      const data = await res.json();
      if (Array.isArray(data)) setSchedules(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);
  useRealtimeSubscription("project_schedules", fetchSchedules);

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const next = currentStatus === "pending" ? "in_progress" : currentStatus === "in_progress" ? "completed" : null;
    if (!next) return;
    await fetch(`/api/schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await fetchSchedules();
  };

  // Timeline calculation
  const today = new Date();
  const timelineStart = new Date(today);
  timelineStart.setDate(timelineStart.getDate() - timelineStart.getDay() + startOffset * 7);
  const timelineEnd = new Date(timelineStart);
  timelineEnd.setDate(timelineEnd.getDate() + viewWeeks * 7);

  // Group by project
  const byProject: Record<string, { name: string; client: string; items: Schedule[] }> = {};
  for (const s of schedules) {
    const key = s.contract_id;
    if (!byProject[key]) {
      byProject[key] = {
        name: s.contracts?.project_name || "알 수 없음",
        client: s.contracts?.clients?.company_name || "",
        items: [],
      };
    }
    byProject[key].items.push(s);
  }

  // Week headers
  const weeks: Date[] = [];
  for (let i = 0; i < viewWeeks; i++) {
    const d = new Date(timelineStart);
    d.setDate(d.getDate() + i * 7);
    weeks.push(d);
  }

  const totalDays = viewWeeks * 7;
  const getBarStyle = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    const startDay = Math.floor((s.getTime() - timelineStart.getTime()) / 86400000);
    const endDay = Math.floor((e.getTime() - timelineStart.getTime()) / 86400000);

    const left = Math.max(0, (startDay / totalDays) * 100);
    const right = Math.min(100, ((endDay + 1) / totalDays) * 100);
    const width = right - left;

    if (width <= 0 || left >= 100 || right <= 0) return null;
    return { left: `${left}%`, width: `${Math.max(width, 1)}%` };
  };

  // Today line
  const todayOffset = Math.floor((today.getTime() - timelineStart.getTime()) / 86400000);
  const todayLeft = (todayOffset / totalDays) * 100;

  // Upcoming deadlines
  const upcomingWeek = schedules.filter((s) => {
    if (!s.end_date) return false;
    const end = new Date(s.end_date);
    const diff = (end.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 7 && s.status !== "completed";
  });

  const upcomingMonth = schedules.filter((s) => {
    if (!s.end_date) return false;
    const end = new Date(s.end_date);
    const diff = (end.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 30 && s.status !== "completed";
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">일정 관리</h1>
        <p className="text-muted-foreground">프로젝트별 제작 일정을 관리합니다.</p>
      </div>

      {/* Deadline summaries */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">이번 주 마감</h3>
          {upcomingWeek.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <ul className="space-y-1">
              {upcomingWeek.map((s) => (
                <li key={s.id} className="text-sm flex justify-between">
                  <span>{s.contracts?.project_name} · {s.phase_name}</span>
                  <span className="text-muted-foreground">{formatDate(s.end_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">이번 달 마감</h3>
          {upcomingMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <ul className="space-y-1">
              {upcomingMonth.slice(0, 8).map((s) => (
                <li key={s.id} className="text-sm flex justify-between">
                  <span>{s.contracts?.project_name} · {s.phase_name}</span>
                  <span className="text-muted-foreground">{formatDate(s.end_date)}</span>
                </li>
              ))}
              {upcomingMonth.length > 8 && (
                <li className="text-xs text-muted-foreground">+{upcomingMonth.length - 8}건 더</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Timeline controls */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setStartOffset((p) => p - 2)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setStartOffset(0)}>
          오늘
        </Button>
        <Button size="sm" variant="outline" onClick={() => setStartOffset((p) => p + 2)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex gap-3 ml-4">
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[k]}`} />
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Gantt chart */}
      {Object.keys(byProject).length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">등록된 일정이 없습니다</h3>
          <p className="mt-2 text-sm text-muted-foreground">계약이 체결되면 일정이 자동 생성됩니다.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          {/* Week headers */}
          <div className="flex border-b bg-muted/50 min-w-[800px]">
            <div className="w-48 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground border-r">
              프로젝트
            </div>
            <div className="flex-1 flex relative">
              {weeks.map((w, i) => (
                <div key={i} className="flex-1 text-center text-xs text-muted-foreground py-2 border-r last:border-0">
                  {w.getMonth() + 1}/{w.getDate()}~
                </div>
              ))}
            </div>
          </div>

          {/* Project rows */}
          {Object.entries(byProject).map(([key, proj]) => (
            <div key={key} className="border-b last:border-0 min-w-[800px]">
              {/* Project name */}
              <div className="flex">
                <div className="w-48 shrink-0 px-3 py-2 border-r">
                  <p className="text-sm font-medium truncate">{proj.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{proj.client}</p>
                </div>
                <div className="flex-1 relative" style={{ minHeight: 40 }}>
                  {/* Today line */}
                  {todayLeft >= 0 && todayLeft <= 100 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                      style={{ left: `${todayLeft}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Phase bars */}
              {proj.items.map((item) => {
                const bar = getBarStyle(item.start_date, item.end_date);
                const color = STATUS_COLORS[item.computed_status] || STATUS_COLORS.pending;
                return (
                  <div key={item.id} className="flex">
                    <div className="w-48 shrink-0 px-3 py-1 border-r">
                      <button
                        onClick={() => handleStatusToggle(item.id, item.computed_status === "delayed" ? "pending" : item.status)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                        {item.phase_name || item.phase}
                      </button>
                    </div>
                    <div className="flex-1 relative h-6">
                      {bar && (
                        <div
                          className={`absolute top-1 h-4 rounded ${color} opacity-80 cursor-pointer hover:opacity-100 transition-opacity`}
                          style={{ left: bar.left, width: bar.width }}
                          title={`${item.phase_name}: ${formatDate(item.start_date)} ~ ${formatDate(item.end_date)} (${STATUS_LABELS[item.computed_status]})`}
                          onClick={() => handleStatusToggle(item.id, item.computed_status === "delayed" ? "pending" : item.status)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
