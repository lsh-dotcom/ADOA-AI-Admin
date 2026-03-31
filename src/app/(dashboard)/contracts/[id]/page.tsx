"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  Users,
  ClipboardList,
  Edit3,
  Check,
  X,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatKRW,
  formatDate,
  CONTRACT_STATUS_MAP,
  CONTRACT_STATUS_TRANSITIONS,
  PAYMENT_STATUS_MAP,
} from "@/lib/format";

type ContractDetail = {
  id: string;
  client_id: string | null;
  project_name: string;
  contract_type: string;
  unit_price: number | null;
  quantity: number;
  total_amount: number;
  vat_included: boolean;
  advance_rate: number;
  advance_amount: number | null;
  balance_amount: number | null;
  contract_start: string | null;
  contract_end: string | null;
  delivery_deadline: string | null;
  status: string;
  contract_pdf_url: string | null;
  pm_id: string | null;
  created_by: string | null;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  clients: {
    id: string;
    company_name: string;
    department: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  } | null;
  payments: Payment[];
  assignments: Assignment[];
  schedules: Schedule[];
};

type Payment = {
  id: string;
  payment_type: string;
  amount: number;
  vat_amount: number | null;
  total_with_vat: number | null;
  invoice_date: string | null;
  due_date: string | null;
  status: string;
  paid_date: string | null;
  paid_amount: number | null;
};

type Assignment = {
  id: string;
  work_days: number | null;
  daily_rate: number | null;
  total_fee: number | null;
  withholding_tax: number | null;
  net_payment: number | null;
  payment_status: string;
  freelancers: {
    name: string;
    specialty: string | null;
    bank_name?: string | null;
    account_number_masked?: string;
  } | null;
};

type FreelancerOption = {
  id: string;
  name: string;
  specialty: string | null;
  daily_rate: number | null;
};

const ASSIGNMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  client_paid: { label: "대금입금", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  approved: { label: "승인됨", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  paid: { label: "지급완료", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
};

type Schedule = {
  id: string;
  phase: string;
  phase_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  assigned_to: string | null;
  notes: string | null;
};

const PHASE_LABELS: Record<string, string> = {
  kickoff: "킥오프",
  planning: "기획",
  pre_production: "프리프로덕션",
  shooting: "촬영",
  editing: "편집",
  first_draft: "1차 시안",
  revision: "수정",
  final_delivery: "최종 납품",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  project: "단건 프로젝트",
  annual: "연간 계약",
  retainer: "리테이너",
};

type Tab = "info" | "payments" | "freelancers" | "schedules";

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [statusChanging, setStatusChanging] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  // 프리랜서 투입 관련
  const [freelancerOptions, setFreelancerOptions] = useState<FreelancerOption[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ freelancer_id: "", work_days: "", daily_rate: "" });
  const [assignSaving, setAssignSaving] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  // 계약서 생성
  const [docGenerating, setDocGenerating] = useState(false);
  const [docText, setDocText] = useState<string | null>(null);
  // 일정 수동 추가
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ phase_name: "", start_date: "", end_date: "" });
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${params.id}`);
      if (!res.ok) {
        router.push("/contracts");
        return;
      }
      const data = await res.json();
      setContract(data);
    } catch {
      router.push("/contracts");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  // 프리랜서 목록 로드
  useEffect(() => {
    fetch("/api/freelancers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFreelancerOptions(data);
      })
      .catch(() => {});
  }, []);

  const handleAddAssignment = async () => {
    if (!assignForm.freelancer_id || !assignForm.work_days || !assignForm.daily_rate) {
      alert("프리랜서, 일수, 일당을 모두 입력해주세요.");
      return;
    }
    setAssignSaving(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: params.id,
          ...assignForm,
        }),
      });
      if (res.ok) {
        setShowAssignForm(false);
        setAssignForm({ freelancer_id: "", work_days: "", daily_rate: "" });
        await fetchContract();
      } else {
        const err = await res.json();
        alert(err.error || "추가에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    }
    setAssignSaving(false);
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("투입을 삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      await fetchContract();
    } catch {
      alert("삭제 실패");
    }
  };

  const handleApproveAssignments = async (action: "approve" | "paid") => {
    const ids = Array.from(selectedAssignments);
    if (ids.length === 0) {
      alert("선택된 항목이 없습니다.");
      return;
    }
    try {
      const res = await fetch("/api/assignments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_ids: ids, action }),
      });
      if (res.ok) {
        setSelectedAssignments(new Set());
        await fetchContract();
      } else {
        const err = await res.json();
        alert(err.error || "처리 실패");
      }
    } catch {
      alert("오류가 발생했습니다.");
    }
  };

  const toggleAssignment = (id: string) => {
    setSelectedAssignments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllAssignments = (assignments: Assignment[], status: string) => {
    const ids = assignments.filter((a) => a.payment_status === status).map((a) => a.id);
    setSelectedAssignments(new Set(ids));
  };

  // 계약서 AI 생성
  const handleGenerateDoc = async () => {
    if (!contract) return;
    setDocGenerating(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/generate-doc`, { method: "POST" });
      const data = await res.json();
      if (data.document) setDocText(data.document);
      else alert(data.error || "계약서 생성 실패");
    } catch { alert("오류가 발생했습니다."); }
    setDocGenerating(false);
  };

  // 정산 상태 변경
  const handlePaymentAction = async (paymentId: string, action: "invoiced" | "paid", payment: Payment) => {
    try {
      if (action === "paid") {
        await fetch(`/api/payments/${paymentId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paid_date: new Date().toISOString().split("T")[0],
            paid_amount: String(payment.total_with_vat || payment.amount),
          }),
        });
      } else if (action === "invoiced") {
        // 청구 완료 처리 — tax-invoice endpoint 활용
        await fetch(`/api/payments/${paymentId}/tax-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tax_invoice_date: new Date().toISOString().split("T")[0] }),
        });
      }
      await fetchContract();
    } catch { alert("상태 변경 실패"); }
  };

  // 일정 수동 추가
  const handleAddSchedule = async () => {
    if (!contract || !scheduleForm.phase_name) return;
    setScheduleSaving(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contract.id,
          phase_name: scheduleForm.phase_name,
          start_date: scheduleForm.start_date || null,
          end_date: scheduleForm.end_date || null,
        }),
      });
      if (res.ok) {
        setShowScheduleForm(false);
        setScheduleForm({ phase_name: "", start_date: "", end_date: "" });
        await fetchContract();
      }
    } catch { alert("일정 추가 실패"); }
    setScheduleSaving(false);
  };

  // 일정 상태 토글
  const handleScheduleStatusToggle = async (scheduleId: string, currentStatus: string) => {
    const next = currentStatus === "pending" ? "in_progress" : currentStatus === "in_progress" ? "completed" : null;
    if (!next) return;
    try {
      await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      await fetchContract();
    } catch { alert("상태 변경 실패"); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!contract) return;
    setStatusChanging(true);

    try {
      const res = await fetch(`/api/contracts/${contract.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "상태 변경에 실패했습니다.");
        return;
      }

      // Refetch to get updated data including new payments/schedules
      await fetchContract();

      if (newStatus === "signed") {
        alert("✅ 계약이 체결되었습니다!\n\n• 프로젝트 일정이 자동 생성되었습니다.\n• 정산 스케줄(선금/잔금)이 자동 생성되었습니다.\n\n각 탭에서 확인하세요.");
      }
    } catch {
      alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setStatusChanging(false);
    }
  };

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const saveEdit = async () => {
    if (!contract || !editingField) return;

    try {
      const body: Record<string, unknown> = {};
      if (
        editingField === "total_amount" ||
        editingField === "unit_price" ||
        editingField === "quantity"
      ) {
        body[editingField] = parseInt(editValue) || 0;
      } else {
        body[editingField] = editValue || null;
      }

      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchContract();
      }
    } catch {
      alert("수정에 실패했습니다.");
    }
    setEditingField(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contract) return null;

  const statusInfo = CONTRACT_STATUS_MAP[contract.status] || CONTRACT_STATUS_MAP.draft;
  const nextStatuses = CONTRACT_STATUS_TRANSITIONS[contract.status] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/contracts")}
            className="mt-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{contract.project_name}</h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
              >
                {statusInfo.label}
              </span>
              {contract.ai_generated && (
                <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                  AI 생성
                </span>
              )}
            </div>
            <p className="text-muted-foreground">
              {contract.clients?.company_name || "거래처 미지정"}
              {contract.clients?.contact_name && ` · ${contract.clients.contact_name}`}
            </p>
          </div>
        </div>

        {/* Status Actions */}
        {nextStatuses.length > 0 && (
          <div className="flex gap-2">
            {nextStatuses.map((ns) => {
              const nsInfo = CONTRACT_STATUS_MAP[ns];
              return (
                <Button
                  key={ns}
                  size="sm"
                  variant={ns === "signed" ? "default" : "outline"}
                  onClick={() => handleStatusChange(ns)}
                  disabled={statusChanging}
                >
                  {statusChanging ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  {nsInfo?.label || ns}(으)로 변경
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        {(
          [
            { key: "info", label: "계약 정보", icon: Building2 },
            { key: "payments", label: "정산 현황", icon: DollarSign },
            { key: "freelancers", label: "프리랜서 투입", icon: Users },
            { key: "schedules", label: "프로젝트 일정", icon: Calendar },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content: 계약 정보 */}
      {activeTab === "info" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 계약 상세 */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              계약 상세
            </h3>
            <dl className="space-y-3 text-sm">
              <EditableField
                label="프로젝트명"
                value={contract.project_name}
                field="project_name"
                editingField={editingField}
                editValue={editValue}
                onStart={startEdit}
                onChange={setEditValue}
                onSave={saveEdit}
                onCancel={() => setEditingField(null)}
              />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">계약 유형</dt>
                <dd>{CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">부가세</dt>
                <dd>{contract.vat_included ? "포함" : "별도"}</dd>
              </div>
              {contract.unit_price && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">회당 단가</dt>
                  <dd className="font-medium">{formatKRW(contract.unit_price)}</dd>
                </div>
              )}
              {contract.quantity > 1 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">수량</dt>
                  <dd>{contract.quantity}회</dd>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <dt className="font-medium">총 계약금액</dt>
                <dd className="text-lg font-bold">{formatKRW(contract.total_amount)}</dd>
              </div>
            </dl>
          </div>

          {/* 결제 조건 */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              결제 조건
            </h3>
            {contract.advance_amount && contract.advance_amount > 0 ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    선금 ({Math.round(contract.advance_rate * 100)}%)
                  </dt>
                  <dd className="font-medium">{formatKRW(contract.advance_amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    잔금 ({Math.round((1 - contract.advance_rate) * 100)}%)
                  </dt>
                  <dd className="font-medium">{formatKRW(contract.balance_amount)}</dd>
                </div>
                {!contract.vat_included && (
                  <div className="border-t pt-3 flex justify-between text-muted-foreground">
                    <dt>부가세 합계</dt>
                    <dd>{formatKRW(Math.round(contract.total_amount * 0.1))}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="text-sm">
                <p>전액 납품 후 결제</p>
                <p className="font-medium text-lg mt-1">
                  {formatKRW(contract.total_amount)}
                </p>
                {!contract.vat_included && (
                  <p className="text-xs text-muted-foreground mt-1">
                    + VAT {formatKRW(Math.round(contract.total_amount * 0.1))}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 기간 */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              계약 기간
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">계약 시작</dt>
                <dd>{formatDate(contract.contract_start)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">계약 종료</dt>
                <dd>{formatDate(contract.contract_end)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">납품 마감</dt>
                <dd className="font-medium">{formatDate(contract.delivery_deadline)}</dd>
              </div>
            </dl>
          </div>

          {/* 거래처 정보 */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              거래처 정보
            </h3>
            {contract.clients ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">거래처명</dt>
                  <dd className="font-medium">{contract.clients.company_name}</dd>
                </div>
                {contract.clients.department && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">부서</dt>
                    <dd>{contract.clients.department}</dd>
                  </div>
                )}
                {contract.clients.contact_name && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">담당자</dt>
                    <dd>{contract.clients.contact_name}</dd>
                  </div>
                )}
                {contract.clients.contact_email && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">이메일</dt>
                    <dd>{contract.clients.contact_email}</dd>
                  </div>
                )}
                {contract.clients.contact_phone && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">연락처</dt>
                    <dd>{contract.clients.contact_phone}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">거래처 정보가 없습니다.</p>
            )}
          </div>

          {/* 계약서 AI 생성 */}
          <div className="lg:col-span-2 rounded-lg border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                계약서 생성
              </h3>
              <Button size="sm" onClick={handleGenerateDoc} disabled={docGenerating}>
                {docGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {docGenerating ? "생성 중..." : "AI 계약서 생성"}
              </Button>
            </div>
            {docText ? (
              <div className="space-y-3">
                <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/50 p-4 text-sm whitespace-pre-wrap font-mono">
                  {docText}
                </div>
                <div className="flex gap-2">
                  <a
                    href={`mailto:${contract.clients?.contact_email || ""}?subject=${encodeURIComponent(`[ADOA] ${contract.project_name} 계약서`)}&body=${encodeURIComponent(docText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline">메일 발송 준비</Button>
                  </a>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(docText); alert("복사되었습니다."); }}>
                    복사
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDocText(null)}>닫기</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                AI가 계약 정보를 기반으로 공식 계약서를 자동 생성합니다.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: 정산 현황 */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {contract.payments.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                정산 내역이 없습니다
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                계약이 체결되면 선금/잔금 정산 레코드가 자동 생성됩니다.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">구분</th>
                    <th className="px-4 py-3 text-right font-medium">금액</th>
                    <th className="px-4 py-3 text-right font-medium">VAT</th>
                    <th className="px-4 py-3 text-right font-medium">합계</th>
                    <th className="px-4 py-3 text-left font-medium">청구일</th>
                    <th className="px-4 py-3 text-left font-medium">입금기한</th>
                    <th className="px-4 py-3 text-left font-medium">상태</th>
                    <th className="px-4 py-3 text-left font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.payments.map((payment) => {
                    const pStatus = PAYMENT_STATUS_MAP[payment.status] || PAYMENT_STATUS_MAP.pending;
                    return (
                      <tr key={payment.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {payment.payment_type === "advance"
                            ? "선금"
                            : payment.payment_type === "balance"
                            ? "잔금"
                            : "월정산"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatKRW(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatKRW(payment.vat_amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatKRW(payment.total_with_vat)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(payment.invoice_date)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(payment.due_date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${pStatus.color}`}
                          >
                            {pStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {payment.status === "pending" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => handlePaymentAction(payment.id, "invoiced", payment)}>
                                청구완료
                              </Button>
                            )}
                            {["pending", "invoiced", "tax_invoice_issued"].includes(payment.status) && (
                              <Button size="sm" className="h-7 text-xs"
                                onClick={() => handlePaymentAction(payment.id, "paid", payment)}>
                                입금확인
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: 프리랜서 투입 */}
      {activeTab === "freelancers" && (
        <div className="space-y-4">
          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {contract.assignments.some((a) => a.payment_status === "client_paid") && (
                <>
                  <Button
                    size="sm"
                    onClick={() => selectAllAssignments(contract.assignments, "client_paid")}
                    variant="outline"
                  >
                    대금입금 건 전체 선택
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproveAssignments("approve")}
                    disabled={selectedAssignments.size === 0}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    승인 ({selectedAssignments.size})
                  </Button>
                </>
              )}
              {contract.assignments.some((a) => a.payment_status === "approved") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectAllAssignments(contract.assignments, "approved")}
                  >
                    승인 건 전체 선택
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproveAssignments("paid")}
                    disabled={selectedAssignments.size === 0}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    지급 완료 ({selectedAssignments.size})
                  </Button>
                </>
              )}
            </div>
            <Button size="sm" onClick={() => setShowAssignForm(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              프리랜서 투입
            </Button>
          </div>

          {/* Add assignment form */}
          {showAssignForm && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h4 className="font-medium text-sm">프리랜서 투입 추가</h4>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">프리랜서</label>
                  <select
                    value={assignForm.freelancer_id}
                    onChange={(e) => {
                      const fId = e.target.value;
                      setAssignForm((prev) => {
                        const f = freelancerOptions.find((fo) => fo.id === fId);
                        return {
                          ...prev,
                          freelancer_id: fId,
                          daily_rate: f?.daily_rate ? String(f.daily_rate) : prev.daily_rate,
                        };
                      });
                    }}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">선택...</option>
                    {freelancerOptions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}{f.specialty ? ` (${f.specialty})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">투입 일수</label>
                  <input
                    type="number"
                    value={assignForm.work_days}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, work_days: e.target.value }))}
                    min="1"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">일당 (원)</label>
                  <input
                    type="number"
                    value={assignForm.daily_rate}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, daily_rate: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={handleAddAssignment} disabled={assignSaving} className="w-full">
                    {assignSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "추가"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAssignForm(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* 실시간 계산 미리보기 */}
              {assignForm.work_days && assignForm.daily_rate && (
                <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                  {(() => {
                    const total = parseInt(assignForm.work_days) * parseInt(assignForm.daily_rate);
                    const tax = Math.round(total * 0.033);
                    return `총액 ${formatKRW(total)} · 원천세 3.3% ${formatKRW(tax)} · 실지급 ${formatKRW(total - tax)}`;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {contract.assignments.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-muted-foreground">총 투입비</p>
                <p className="text-lg font-bold">
                  {formatKRW(contract.assignments.reduce((s, a) => s + (a.total_fee || 0), 0))}
                </p>
              </div>
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-muted-foreground">원천세 합계</p>
                <p className="text-lg font-bold">
                  {formatKRW(contract.assignments.reduce((s, a) => s + (a.withholding_tax || 0), 0))}
                </p>
              </div>
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="text-muted-foreground">실지급 합계</p>
                <p className="text-lg font-bold">
                  {formatKRW(contract.assignments.reduce((s, a) => s + (a.net_payment || 0), 0))}
                </p>
              </div>
            </div>
          )}

          {/* Table */}
          {contract.assignments.length === 0 && !showAssignForm ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">투입된 프리랜서가 없습니다</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                위의 &quot;프리랜서 투입&quot; 버튼으로 프리랜서를 배정하세요.
              </p>
            </div>
          ) : contract.assignments.length > 0 && (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-3 w-8">
                      <span className="sr-only">선택</span>
                    </th>
                    <th className="px-3 py-3 text-left font-medium">이름</th>
                    <th className="px-3 py-3 text-left font-medium">전문분야</th>
                    <th className="px-3 py-3 text-right font-medium">일수</th>
                    <th className="px-3 py-3 text-right font-medium">일당</th>
                    <th className="px-3 py-3 text-right font-medium">총액</th>
                    <th className="px-3 py-3 text-right font-medium">원천세</th>
                    <th className="px-3 py-3 text-right font-medium">실지급</th>
                    <th className="px-3 py-3 text-left font-medium">상태</th>
                    <th className="px-3 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {contract.assignments.map((a) => {
                    const st = ASSIGNMENT_STATUS_LABELS[a.payment_status] || ASSIGNMENT_STATUS_LABELS.pending;
                    return (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-3">
                          {["client_paid", "approved"].includes(a.payment_status) && (
                            <input
                              type="checkbox"
                              checked={selectedAssignments.has(a.id)}
                              onChange={() => toggleAssignment(a.id)}
                              className="rounded border-input"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium">{a.freelancers?.name || "-"}</td>
                        <td className="px-3 py-3 text-muted-foreground">{a.freelancers?.specialty || "-"}</td>
                        <td className="px-3 py-3 text-right">{a.work_days || "-"}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatKRW(a.daily_rate)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatKRW(a.total_fee)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatKRW(a.withholding_tax)}</td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{formatKRW(a.net_payment)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {a.payment_status === "pending" && (
                            <button
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: 프로젝트 일정 */}
      {activeTab === "schedules" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowScheduleForm(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              일정 추가
            </Button>
          </div>

          {/* Manual add form */}
          {showScheduleForm && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h4 className="text-sm font-medium">일정 수동 추가</h4>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-xs text-muted-foreground">단계명</label>
                  <input value={scheduleForm.phase_name}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, phase_name: e.target.value }))}
                    placeholder="예: 현장 답사"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">시작일</label>
                  <input type="date" value={scheduleForm.start_date}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">종료일</label>
                  <input type="date" value={scheduleForm.end_date}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, end_date: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={handleAddSchedule} disabled={scheduleSaving} className="w-full">
                    {scheduleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "추가"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowScheduleForm(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {contract.schedules.length === 0 && !showScheduleForm ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">등록된 일정이 없습니다</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                계약 체결 시 자동 생성되거나, 위의 버튼으로 수동 추가하세요.
              </p>
            </div>
          ) : contract.schedules.length > 0 && (
            <div className="space-y-2">
              {contract.schedules.map((s) => {
                const isDelayed = s.status === "pending" && s.end_date && s.end_date < new Date().toISOString().split("T")[0];
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors">
                    {/* Status indicator + click to toggle */}
                    <button
                      onClick={() => handleScheduleStatusToggle(s.id, s.status)}
                      className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        s.status === "completed"
                          ? "border-green-500 bg-green-500 text-white"
                          : s.status === "in_progress"
                          ? "border-blue-500 bg-blue-100 dark:bg-blue-900"
                          : isDelayed
                          ? "border-red-500 bg-red-100 dark:bg-red-900"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      title={s.status === "pending" ? "클릭: 진행중으로" : s.status === "in_progress" ? "클릭: 완료로" : "완료됨"}
                    >
                      {s.status === "completed" && <Check className="h-3 w-3" />}
                      {s.status === "in_progress" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${s.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                        {s.phase_name || PHASE_LABELS[s.phase] || s.phase}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(s.start_date)} ~ {formatDate(s.end_date)}
                      </p>
                    </div>

                    {s.assigned_to && (
                      <span className="text-xs text-muted-foreground">{s.assigned_to}</span>
                    )}

                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      s.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : s.status === "in_progress"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : isDelayed
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}>
                      {s.status === "completed" ? "완료" : s.status === "in_progress" ? "진행중" : isDelayed ? "지연" : "대기"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Meta Info */}
      <div className="border-t pt-4 text-xs text-muted-foreground flex gap-4">
        <span>등록: {formatDate(contract.created_at)}</span>
        <span>수정: {formatDate(contract.updated_at)}</span>
        {contract.created_by && <span>작성자: {contract.created_by}</span>}
      </div>
    </div>
  );
}

// Inline editable field component
function EditableField({
  label,
  value,
  field,
  editingField,
  editValue,
  onStart,
  onChange,
  onSave,
  onCancel,
}: {
  label: string;
  value: string;
  field: string;
  editingField: string | null;
  editValue: string;
  onStart: (field: string, value: string) => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (editingField === field) {
    return (
      <div className="flex items-center justify-between gap-2">
        <dt className="text-muted-foreground">{label}</dt>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
            className="w-48 rounded border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            autoFocus
          />
          <button onClick={onSave} className="text-green-600 hover:text-green-700">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1">
        {value}
        <button
          onClick={() => onStart(field, value)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        >
          <Edit3 className="h-3 w-3" />
        </button>
      </dd>
    </div>
  );
}
