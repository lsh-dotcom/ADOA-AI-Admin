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
  freelancers: { name: string; specialty: string | null } | null;
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

      // Refetch to get updated data including new payments
      await fetchContract();
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
          {contract.assignments.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                투입된 프리랜서가 없습니다
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                프리랜서 관리에서 이 프로젝트에 프리랜서를 배정하세요.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">이름</th>
                    <th className="px-4 py-3 text-left font-medium">전문분야</th>
                    <th className="px-4 py-3 text-right font-medium">일수</th>
                    <th className="px-4 py-3 text-right font-medium">일당</th>
                    <th className="px-4 py-3 text-right font-medium">총액</th>
                    <th className="px-4 py-3 text-right font-medium">원천세</th>
                    <th className="px-4 py-3 text-right font-medium">실지급</th>
                    <th className="px-4 py-3 text-left font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.assignments.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {a.freelancers?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.freelancers?.specialty || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">{a.work_days || "-"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatKRW(a.daily_rate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatKRW(a.total_fee)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatKRW(a.withholding_tax)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatKRW(a.net_payment)}
                      </td>
                      <td className="px-4 py-3">{a.payment_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: 프로젝트 일정 */}
      {activeTab === "schedules" && (
        <div className="space-y-4">
          {contract.schedules.length === 0 ? (
            <div className="rounded-lg border bg-card p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                등록된 일정이 없습니다
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                일정 관리에서 이 프로젝트의 제작 일정을 등록하세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {contract.schedules.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4"
                >
                  <div className="flex-1">
                    <p className="font-medium">
                      {s.phase_name || PHASE_LABELS[s.phase] || s.phase}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(s.start_date)} ~ {formatDate(s.end_date)}
                    </p>
                  </div>
                  {s.assigned_to && (
                    <span className="text-sm text-muted-foreground">
                      {s.assigned_to}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : s.status === "in_progress"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {s.status === "completed"
                      ? "완료"
                      : s.status === "in_progress"
                      ? "진행중"
                      : "대기"}
                  </span>
                </div>
              ))}
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
