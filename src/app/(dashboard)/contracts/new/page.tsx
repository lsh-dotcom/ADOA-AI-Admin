"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, FileText, Loader2, Sparkles, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKRW } from "@/lib/format";

type Client = {
  id: string;
  company_name: string;
  contact_name: string | null;
};

type ContractForm = {
  client_id: string;
  client: {
    company_name: string;
    department: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
  };
  project_name: string;
  contract_type: "project" | "annual" | "retainer";
  unit_price: string;
  quantity: string;
  total_amount: string;
  vat_included: boolean;
  contract_start: string;
  contract_end: string;
  delivery_deadline: string;
  notes: string;
};

const emptyForm: ContractForm = {
  client_id: "",
  client: {
    company_name: "",
    department: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  },
  project_name: "",
  contract_type: "project",
  unit_price: "",
  quantity: "1",
  total_amount: "",
  vat_included: false,
  contract_start: "",
  contract_end: "",
  delivery_deadline: "",
  notes: "",
};

export default function NewContractPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [aiText, setAiText] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [missingInfo, setMissingInfo] = useState<string[]>([]);
  const [form, setForm] = useState<ContractForm>(emptyForm);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [useNewClient, setUseNewClient] = useState(true);
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(() => {});
  }, []);

  // 단가 × 수량 자동 계산
  useEffect(() => {
    const price = parseInt(form.unit_price) || 0;
    const qty = parseInt(form.quantity) || 1;
    if (price > 0) {
      setForm((prev) => ({ ...prev, total_amount: String(price * qty) }));
    }
  }, [form.unit_price, form.quantity]);

  const totalAmount = parseInt(form.total_amount) || 0;
  const isOver3M = totalAmount >= 3000000;
  const advanceAmount = isOver3M ? Math.round(totalAmount * 0.3) : 0;
  const balanceAmount = isOver3M ? totalAmount - advanceAmount : totalAmount;

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setAiParsing(true);
    setAiError(null);
    setMissingInfo([]);

    try {
      const res = await fetch("/api/ai/parse-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || "AI 파싱에 실패했습니다.");
        return;
      }

      // 폼에 자동 채움
      setForm({
        client_id: "",
        client: {
          company_name: data.client?.company_name || "",
          department: data.client?.department || "",
          contact_name: data.client?.contact_name || "",
          contact_email: data.client?.contact_email || "",
          contact_phone: data.client?.contact_phone || "",
        },
        project_name: data.project_name || "",
        contract_type: data.contract_type || "project",
        unit_price: data.unit_price ? String(data.unit_price) : "",
        quantity: data.quantity ? String(data.quantity) : "1",
        total_amount: data.total_amount ? String(data.total_amount) : "",
        vat_included: data.vat_included ?? false,
        contract_start: data.contract_start || "",
        contract_end: data.contract_end || "",
        delivery_deadline: data.delivery_deadline || "",
        notes: data.notes || "",
      });

      setUseNewClient(true);
      setAiGenerated(true);
      setMode("manual"); // 폼 모드로 전환하여 확인

      if (data.missing_info && data.missing_info.length > 0) {
        setMissingInfo(data.missing_info);
      }
    } catch {
      setAiError("AI 서비스에 연결할 수 없습니다.");
    } finally {
      setAiParsing(false);
    }
  };

  const handleSave = async () => {
    if (!form.project_name.trim()) {
      alert("프로젝트명을 입력해주세요.");
      return;
    }
    if (!totalAmount) {
      alert("총 계약금액을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        project_name: form.project_name,
        contract_type: form.contract_type,
        unit_price: form.unit_price ? parseInt(form.unit_price) : null,
        quantity: parseInt(form.quantity) || 1,
        total_amount: totalAmount,
        vat_included: form.vat_included,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        delivery_deadline: form.delivery_deadline || null,
        ai_generated: aiGenerated,
      };

      if (useNewClient && form.client.company_name) {
        body.client = form.client;
      } else if (form.client_id) {
        body.client_id = form.client_id;
      }

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "저장에 실패했습니다.");
        return;
      }

      const contract = await res.json();
      router.push(`/contracts/${contract.id}`);
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">새 계약</h1>
          <p className="text-muted-foreground">
            AI로 빠르게 입력하거나 직접 폼을 작성하세요.
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        <button
          onClick={() => setMode("ai")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === "ai"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          AI 입력
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === "manual"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          직접 입력
        </button>
      </div>

      {/* AI Input Mode */}
      {mode === "ai" && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Bot className="mt-1 h-5 w-5 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold">AI 계약 입력</h3>
              <p className="text-sm text-muted-foreground">
                자연어로 계약 정보를 입력하면 AI가 자동으로 구조화합니다.
              </p>
            </div>
          </div>

          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder={`예시: 삼성전자 웰스토리 사내방송, 월 2회 제작, 6개월 계약, 회당 500만원 부가세 별도, 4월 15일 시작, 담당자 김OO 과장 kim@samsung.com`}
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />

          {aiError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {aiError}
            </div>
          )}

          <Button
            onClick={handleAiParse}
            disabled={aiParsing || !aiText.trim()}
            className="w-full"
          >
            {aiParsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                AI 분석 중...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                AI로 분석하기
              </>
            )}
          </Button>
        </div>
      )}

      {/* Manual Form / AI Result */}
      {mode === "manual" && (
        <div className="space-y-6">
          {/* Missing Info Alert */}
          {missingInfo.length > 0 && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  AI가 추출하지 못한 정보
                </span>
              </div>
              <ul className="list-disc pl-5 text-sm text-yellow-700 dark:text-yellow-400">
                {missingInfo.map((info, i) => (
                  <li key={i}>{info}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 거래처 정보 */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold">거래처 정보</h3>

            {clients.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setUseNewClient(true)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    useNewClient
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  신규 거래처
                </button>
                <button
                  onClick={() => setUseNewClient(false)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    !useNewClient
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  기존 거래처
                </button>
              </div>
            )}

            {useNewClient ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">거래처명 *</label>
                  <input
                    value={form.client.company_name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        client: { ...prev.client, company_name: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">부서</label>
                  <input
                    value={form.client.department}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        client: { ...prev.client, department: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">담당자명</label>
                  <input
                    value={form.client.contact_name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        client: { ...prev.client, contact_name: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">이메일</label>
                  <input
                    type="email"
                    value={form.client.contact_email}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        client: { ...prev.client, contact_email: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">연락처</label>
                  <input
                    value={form.client.contact_phone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        client: { ...prev.client, contact_phone: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            ) : (
              <select
                value={form.client_id}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, client_id: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">거래처 선택...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                    {c.contact_name ? ` (${c.contact_name})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 계약 정보 */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold">계약 정보</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">프로젝트명 *</label>
                <input
                  value={form.project_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, project_name: e.target.value }))
                  }
                  placeholder="예: 2026 사내방송 연간계약"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">계약 유형</label>
                <select
                  value={form.contract_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      contract_type: e.target.value as ContractForm["contract_type"],
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="project">단건 프로젝트</option>
                  <option value="annual">연간 계약</option>
                  <option value="retainer">리테이너</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.vat_included}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, vat_included: e.target.checked }))
                    }
                    className="rounded border-input"
                  />
                  부가세 포함
                </label>
              </div>
            </div>

            {/* 금액 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm font-medium">회당 단가 (원)</label>
                <input
                  type="number"
                  value={form.unit_price}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, unit_price: e.target.value }))
                  }
                  placeholder="5,000,000"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">수량 (회)</label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                  min="1"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">총 계약금액 (원) *</label>
                <input
                  type="number"
                  value={form.total_amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, total_amount: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* 결제조건 미리보기 */}
            {totalAmount > 0 && (
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm font-medium mb-1">결제조건</p>
                {isOver3M ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      선금 30%:{" "}
                      <span className="font-medium text-foreground">
                        {formatKRW(advanceAmount)}
                      </span>
                    </p>
                    <p>
                      잔금 70%:{" "}
                      <span className="font-medium text-foreground">
                        {formatKRW(balanceAmount)}
                      </span>
                    </p>
                    {!form.vat_included && (
                      <p className="text-xs mt-1">
                        * 부가세 별도 (선금 VAT: {formatKRW(Math.round(advanceAmount * 0.1))}, 잔금 VAT: {formatKRW(Math.round(balanceAmount * 0.1))})
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    전액 납품 후 결제:{" "}
                    <span className="font-medium text-foreground">
                      {formatKRW(totalAmount)}
                    </span>
                    {!form.vat_included && (
                      <span className="text-xs ml-1">
                        (+ VAT {formatKRW(Math.round(totalAmount * 0.1))})
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 기간 */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold">계약 기간</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm font-medium">계약 시작일</label>
                <input
                  type="date"
                  value={form.contract_start}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, contract_start: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">계약 종료일</label>
                <input
                  type="date"
                  value={form.contract_end}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, contract_end: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">납품 마감일</label>
                <input
                  type="date"
                  value={form.delivery_deadline}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, delivery_deadline: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* 비고 */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold">비고</h3>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
              placeholder="특이사항, 추가 조건 등"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => router.back()}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                "계약 저장"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
