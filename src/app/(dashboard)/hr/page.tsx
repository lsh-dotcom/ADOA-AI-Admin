"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Edit3,
  Trash2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeSubscription } from "@/hooks/use-realtime";

type Employee = {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  contract_type: string | null;
  probation_end_date: string | null;
  salary: number | null;
  phone: string | null;
  email: string | null;
  emergency_contact: string | null;
  annual_leave_total: number;
  annual_leave_used: number;
  status: string;
};

type Attendance = {
  id: string;
  employee_id: string;
  date: string;
  type: string;
  note: string | null;
};

type EmpForm = {
  name: string; position: string; department: string; hire_date: string;
  contract_type: string; phone: string; email: string; emergency_contact: string;
  annual_leave_total: string;
};

const emptyForm: EmpForm = {
  name: "", position: "", department: "", hire_date: "",
  contract_type: "full_time", phone: "", email: "", emergency_contact: "",
  annual_leave_total: "15",
};

const ATT_TYPES: Record<string, { label: string; color: string; short: string }> = {
  present: { label: "출근", color: "bg-green-500", short: "출" },
  annual_leave: { label: "연차", color: "bg-orange-500", short: "연" },
  half_day: { label: "반차", color: "bg-yellow-500", short: "반" },
  sick: { label: "병가", color: "bg-red-500", short: "병" },
  remote: { label: "재택", color: "bg-blue-500", short: "재" },
  field_work: { label: "외근", color: "bg-purple-500", short: "외" },
};

const CONTRACT_TYPES: Record<string, string> = {
  full_time: "정규직", contract: "계약직", intern: "인턴",
};

type View = "list" | "attendance";

export default function HRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<EmpForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Attendance
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [attMonth, setAttMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attModal, setAttModal] = useState<{ date: string } | null>(null);
  const [attType, setAttType] = useState("present");
  const [attNote, setAttNote] = useState("");
  const [attSummary, setAttSummary] = useState<Record<string, number>>({});

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/employees?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useRealtimeSubscription("employees", fetchEmployees);

  const fetchAttendance = useCallback(async () => {
    if (!selectedEmp) return;
    setAttLoading(true);
    const [attRes, sumRes] = await Promise.all([
      fetch(`/api/attendance?employee_id=${selectedEmp.id}&month=${attMonth}`),
      fetch(`/api/attendance/summary?employee_id=${selectedEmp.id}&month=${attMonth}`),
    ]);
    const attData = await attRes.json();
    const sumData = await sumRes.json();
    if (Array.isArray(attData)) setAttendance(attData);
    if (sumData && !sumData.error) setAttSummary(sumData);
    setAttLoading(false);
  }, [selectedEmp, attMonth]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const handleSaveEmp = async () => {
    if (!form.name.trim()) { alert("이름을 입력해주세요."); return; }
    setSaving(true);
    const url = editId ? `/api/employees/${editId}` : "/api/employees";
    const method = editId ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setModal(null); await fetchEmployees(); }
      else { const e = await res.json(); alert(e.error || "실패"); }
    } catch { alert("오류"); }
    setSaving(false);
  };

  const handleDeleteEmp = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    await fetchEmployees();
  };

  const handleSaveAttendance = async () => {
    if (!selectedEmp || !attModal) return;
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: selectedEmp.id, date: attModal.date, type: attType, note: attNote }),
    });
    setAttModal(null);
    setAttNote("");
    await fetchAttendance();
  };

  const openEdit = (e: Employee) => {
    setForm({
      name: e.name, position: e.position || "", department: e.department || "",
      hire_date: e.hire_date || "", contract_type: e.contract_type || "full_time",
      phone: e.phone || "", email: e.email || "", emergency_contact: e.emergency_contact || "",
      annual_leave_total: String(e.annual_leave_total),
    });
    setEditId(e.id); setModal("edit");
  };

  // Calendar generation
  const [calYear, calMonth] = attMonth.split("-").map(Number);
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  const calDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calDays.push(i);

  const getAttForDay = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return attendance.find((a) => a.date === dateStr);
  };

  const changeMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setAttMonth(`${y}-${String(m).padStart(2, "0")}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">인사 관리</h1>
          <p className="text-muted-foreground">직원 정보, 근태, 연차를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 rounded-lg border bg-muted p-1">
            <button onClick={() => setView("list")} className={`rounded-md px-3 py-1 text-sm font-medium ${view === "list" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              직원 목록
            </button>
            <button onClick={() => setView("attendance")} className={`rounded-md px-3 py-1 text-sm font-medium ${view === "attendance" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              근태 관리
            </button>
          </div>
          {view === "list" && (
            <Button onClick={() => { setForm(emptyForm); setEditId(null); setModal("add"); }}>
              <Plus className="mr-2 h-4 w-4" />직원 등록
            </Button>
          )}
        </div>
      </div>

      {view === "list" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="이름 또는 부서 검색..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : employees.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">등록된 직원이 없습니다</h3>
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">이름</th>
                      <th className="px-4 py-3 text-left font-medium">직책</th>
                      <th className="px-4 py-3 text-left font-medium">부서</th>
                      <th className="px-4 py-3 text-left font-medium">유형</th>
                      <th className="px-4 py-3 text-left font-medium">입사일</th>
                      <th className="px-4 py-3 text-center font-medium">연차</th>
                      <th className="px-4 py-3 text-left font-medium">연락처</th>
                      <th className="px-4 py-3 text-left font-medium">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3">{e.position || "-"}</td>
                        <td className="px-4 py-3">{e.department || "-"}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="rounded-full bg-muted px-2 py-0.5">{CONTRACT_TYPES[e.contract_type || ""] || e.contract_type}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{e.hire_date || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-medium">{e.annual_leave_total - e.annual_leave_used}</span>
                          <span className="text-muted-foreground text-xs">/{e.annual_leave_total}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{e.phone || e.email || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setSelectedEmp(e); setView("attendance"); }} className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => openEdit(e)} className="rounded p-1 hover:bg-muted">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeleteEmp(e.id)} className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {view === "attendance" && (
        <div className="space-y-4">
          {/* Employee selector */}
          <div className="flex gap-4 items-center flex-wrap">
            <select
              value={selectedEmp?.id || ""}
              onChange={(e) => setSelectedEmp(employees.find((emp) => emp.id === e.target.value) || null)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">직원 선택...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.department || emp.position || "-"})</option>
              ))}
            </select>

            {selectedEmp && (
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" onClick={() => changeMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium w-24 text-center">{calYear}년 {calMonth}월</span>
                <Button size="icon" variant="ghost" onClick={() => changeMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>

          {selectedEmp && (
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Calendar */}
              <div className="lg:col-span-2 rounded-lg border bg-card p-4">
                {attLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
                      {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                        <div key={d} className="py-1 font-medium">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calDays.map((day, i) => {
                        if (day === null) return <div key={`e${i}`} />;
                        const att = getAttForDay(day);
                        const attInfo = att ? ATT_TYPES[att.type] : null;
                        const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isToday = dateStr === new Date().toISOString().split("T")[0];

                        return (
                          <button
                            key={day}
                            onClick={() => { setAttModal({ date: dateStr }); setAttType(att?.type || "present"); setAttNote(att?.note || ""); }}
                            className={`relative rounded-md p-2 text-sm hover:bg-muted transition-colors ${isToday ? "ring-2 ring-primary" : ""}`}
                          >
                            <span className={`${isToday ? "font-bold" : ""}`}>{day}</span>
                            {attInfo && (
                              <div className={`mt-1 mx-auto h-1.5 w-1.5 rounded-full ${attInfo.color}`} title={attInfo.label} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="flex gap-3 mt-3 flex-wrap">
                      {Object.entries(ATT_TYPES).map(([k, v]) => (
                        <span key={k} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className={`h-2 w-2 rounded-full ${v.color}`} />{v.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Summary sidebar */}
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="text-sm font-medium mb-3">연차 현황</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">총 연차</span>
                      <span className="font-medium">{selectedEmp.annual_leave_total}일</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">사용</span>
                      <span className="font-medium">{selectedEmp.annual_leave_used}일</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-medium">잔여 연차</span>
                      <span className="text-lg font-bold text-primary">{selectedEmp.annual_leave_total - selectedEmp.annual_leave_used}일</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(selectedEmp.annual_leave_used / selectedEmp.annual_leave_total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <h3 className="text-sm font-medium mb-3">{calMonth}월 근태 요약</h3>
                  <div className="space-y-2 text-sm">
                    {Object.entries(ATT_TYPES).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className={`h-2 w-2 rounded-full ${v.color}`} />{v.label}
                        </span>
                        <span className="font-medium">{attSummary[k] || 0}일</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!selectedEmp && (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">직원을 선택해주세요</h3>
              <p className="mt-2 text-sm text-muted-foreground">위 드롭다운에서 직원을 선택하면 근태를 관리할 수 있습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* Employee add/edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[85vh] rounded-lg border bg-background p-6 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{modal === "add" ? "직원 등록" : "직원 수정"}</h3>
              <button onClick={() => setModal(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">이름 *</label>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">직책</label>
                  <input value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">부서</label>
                  <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">고용 유형</label>
                  <select value={form.contract_type} onChange={(e) => setForm((p) => ({ ...p, contract_type: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="full_time">정규직</option><option value="contract">계약직</option><option value="intern">인턴</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">입사일</label>
                  <input type="date" value={form.hire_date} onChange={(e) => setForm((p) => ({ ...p, hire_date: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">총 연차</label>
                  <input type="number" value={form.annual_leave_total} onChange={(e) => setForm((p) => ({ ...p, annual_leave_total: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">연락처</label>
                  <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium">이메일</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">비상 연락처</label>
                <input value={form.emergency_contact} onChange={(e) => setForm((p) => ({ ...p, emergency_contact: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setModal(null)}>취소</Button>
                <Button onClick={handleSaveEmp} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {modal === "add" ? "등록" : "저장"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance record modal */}
      {attModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">근태 기록</h3>
              <button onClick={() => setAttModal(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{selectedEmp?.name} · {attModal.date}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(ATT_TYPES).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setAttType(k)}
                    className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                      attType === k ? `${v.color} text-white` : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium">메모</label>
                <input value={attNote} onChange={(e) => setAttNote(e.target.value)} placeholder="삼성 촬영 외근"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAttModal(null)}>취소</Button>
                <Button onClick={handleSaveAttendance}>저장</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
