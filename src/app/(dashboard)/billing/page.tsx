"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DollarSign,
  AlertTriangle,
  FileText,
  Receipt,
  Search,
  Upload,
  Loader2,
  Check,
  X,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKRW, formatDate, PAYMENT_STATUS_MAP } from "@/lib/format";

type Payment = {
  id: string;
  contract_id: string;
  payment_type: string;
  amount: number;
  vat_amount: number | null;
  total_with_vat: number | null;
  invoice_date: string | null;
  due_date: string | null;
  tax_invoice_date: string | null;
  status: string;
  paid_date: string | null;
  paid_amount: number | null;
  overdue_days: number;
  contracts: {
    project_name: string;
    clients: { company_name: string; contact_name: string | null } | null;
  } | null;
};

type Summary = {
  monthly_revenue: number;
  total_unpaid: number;
  monthly_due: number;
  tax_invoice_pending: number;
  overdue_count: number;
};

type CsvMatchResult = {
  csv_row: { company_name: string; amount: number; paid_date: string };
  matched: boolean;
  payment_id?: string;
  project_name?: string;
  expected_amount?: number;
  match_type?: "exact" | "partial";
  reason?: string;
};

const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "미청구" },
  { key: "invoiced", label: "청구완료" },
  { key: "paid", label: "입금확인" },
  { key: "overdue", label: "연체" },
  { key: "confirmed", label: "정산완료" },
] as const;

function OverdueBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  let color = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
  if (days >= 30) color = "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  else if (days >= 14) color = "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      D+{days}
    </span>
  );
}

export default function BillingPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  // 입금 확인 모달
  const [confirmModal, setConfirmModal] = useState<Payment | null>(null);
  const [confirmDate, setConfirmDate] = useState("");
  const [confirmAmount, setConfirmAmount] = useState("");
  const [confirming, setConfirming] = useState(false);

  // 세금계산서 모달
  const [taxModal, setTaxModal] = useState<Payment | null>(null);
  const [taxDate, setTaxDate] = useState("");
  const [taxProcessing, setTaxProcessing] = useState(false);

  // CSV 업로드
  const [csvModal, setCsvModal] = useState(false);
  const [csvResults, setCsvResults] = useState<CsvMatchResult[] | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvApplying, setCsvApplying] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab !== "all") params.set("status", activeTab);

    const [paymentsRes, summaryRes] = await Promise.all([
      fetch(`/api/payments?${params}`),
      fetch("/api/payments/summary"),
    ]);

    const paymentsData = await paymentsRes.json();
    const summaryData = await summaryRes.json();

    if (Array.isArray(paymentsData)) setPayments(paymentsData);
    if (summaryData.monthly_revenue !== undefined) setSummary(summaryData);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPayments = payments.filter((p) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      p.contracts?.project_name?.toLowerCase().includes(query) ||
      p.contracts?.clients?.company_name?.toLowerCase().includes(query)
    );
  });

  // 입금 확인 처리
  const handleConfirmPayment = async () => {
    if (!confirmModal) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/payments/${confirmModal.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paid_date: confirmDate,
          paid_amount: confirmAmount,
        }),
      });
      if (res.ok) {
        setConfirmModal(null);
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "처리에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    }
    setConfirming(false);
  };

  // 세금계산서 발행 처리
  const handleTaxInvoice = async () => {
    if (!taxModal) return;
    setTaxProcessing(true);
    try {
      const res = await fetch(`/api/payments/${taxModal.id}/tax-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tax_invoice_date: taxDate }),
      });
      if (res.ok) {
        setTaxModal(null);
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "처리에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    }
    setTaxProcessing(false);
  };

  // CSV 파일 업로드 & 매칭
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    setCsvResults(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());

      // 첫 줄 헤더 스킵, 각 줄 파싱
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
        return {
          company_name: cols[0] || "",
          amount: parseInt(cols[1]?.replace(/[^0-9]/g, "")) || 0,
          paid_date: cols[2] || new Date().toISOString().split("T")[0],
        };
      });

      const res = await fetch("/api/payments/csv-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();
      if (data.results) {
        setCsvResults(data.results);
      }
    } catch {
      alert("CSV 파일 처리 중 오류가 발생했습니다.");
    }
    setCsvUploading(false);
    // input 초기화
    e.target.value = "";
  };

  // CSV 매칭 결과 일괄 적용
  const handleCsvApply = async () => {
    if (!csvResults) return;
    setCsvApplying(true);

    const confirmations = csvResults
      .filter((r) => r.matched && r.payment_id)
      .map((r) => ({
        payment_id: r.payment_id,
        paid_date: r.csv_row.paid_date,
        paid_amount: r.csv_row.amount,
      }));

    try {
      const res = await fetch("/api/payments/csv-match", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmations }),
      });
      const data = await res.json();
      alert(`${data.success}건 적용 완료${data.failed > 0 ? `, ${data.failed}건 실패` : ""}`);
      setCsvModal(false);
      setCsvResults(null);
      await fetchData();
    } catch {
      alert("일괄 적용 중 오류가 발생했습니다.");
    }
    setCsvApplying(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">정산 관리</h1>
          <p className="text-muted-foreground">
            청구서 발행, 입금 확인, 세금계산서를 관리합니다.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCsvModal(true)}>
          <Upload className="mr-2 h-4 w-4" />
          CSV 입금 매칭
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">이번 달 매출</h3>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatKRW(summary.monthly_revenue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">입금 확인된 금액</p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">미수금 총액</h3>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatKRW(summary.total_unpaid)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.overdue_count > 0
                ? `연체 ${summary.overdue_count}건 포함`
                : "미입금 건"}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">이번 달 청구 예정</h3>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatKRW(summary.monthly_due)}</p>
            <p className="mt-1 text-xs text-muted-foreground">청구 대기 중</p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">세금계산서 대기</h3>
              <Receipt className="h-4 w-4 text-purple-500" />
            </div>
            <p className="mt-2 text-2xl font-bold">{summary.tax_invoice_pending}건</p>
            <p className="mt-1 text-xs text-muted-foreground">발행 필요</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="프로젝트명 또는 거래처명으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">정산 내역이 없습니다</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            계약이 체결되면 정산 내역이 자동 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">프로젝트</th>
                  <th className="px-4 py-3 text-left font-medium">거래처</th>
                  <th className="px-4 py-3 text-left font-medium">유형</th>
                  <th className="px-4 py-3 text-right font-medium">공급가</th>
                  <th className="px-4 py-3 text-right font-medium">VAT</th>
                  <th className="px-4 py-3 text-right font-medium">합계</th>
                  <th className="px-4 py-3 text-left font-medium">청구일</th>
                  <th className="px-4 py-3 text-left font-medium">입금기한</th>
                  <th className="px-4 py-3 text-left font-medium">상태</th>
                  <th className="px-4 py-3 text-left font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const statusInfo = PAYMENT_STATUS_MAP[p.status] || PAYMENT_STATUS_MAP.pending;
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {p.contracts?.project_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.contracts?.clients?.company_name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {p.payment_type === "advance"
                          ? "선금"
                          : p.payment_type === "balance"
                          ? "잔금"
                          : "월정산"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatKRW(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatKRW(p.vat_amount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatKRW(p.total_with_vat)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(p.invoice_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {formatDate(p.due_date)}
                          </span>
                          <OverdueBadge days={p.overdue_days} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {["pending", "invoiced", "tax_invoice_issued"].includes(p.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setConfirmModal(p);
                                setConfirmDate(new Date().toISOString().split("T")[0]);
                                setConfirmAmount(String(p.total_with_vat || p.amount));
                              }}
                            >
                              입금 확인
                            </Button>
                          )}
                          {p.status === "paid" && !p.tax_invoice_date && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setTaxModal(p);
                                setTaxDate(new Date().toISOString().split("T")[0]);
                              }}
                            >
                              세금계산서
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
        </div>
      )}

      {/* 입금 확인 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">입금 확인</h3>
              <button onClick={() => setConfirmModal(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{confirmModal.contracts?.project_name}</p>
                <p className="text-muted-foreground">
                  {confirmModal.contracts?.clients?.company_name} ·{" "}
                  {confirmModal.payment_type === "advance" ? "선금" : "잔금"}
                </p>
                <p className="font-bold mt-1">{formatKRW(confirmModal.total_with_vat)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">입금일</label>
                <input
                  type="date"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">입금액 (원)</label>
                <input
                  type="number"
                  value={confirmAmount}
                  onChange={(e) => setConfirmAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setConfirmModal(null)}>
                  취소
                </Button>
                <Button onClick={handleConfirmPayment} disabled={confirming}>
                  {confirming ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  입금 확인
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 세금계산서 발행 모달 */}
      {taxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">세금계산서 발행 완료</h3>
              <button onClick={() => setTaxModal(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{taxModal.contracts?.project_name}</p>
                <p className="text-muted-foreground">
                  {taxModal.contracts?.clients?.company_name}
                </p>
                <p className="font-bold mt-1">{formatKRW(taxModal.total_with_vat)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">발행일</label>
                <input
                  type="date"
                  value={taxDate}
                  onChange={(e) => setTaxDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setTaxModal(null)}>
                  취소
                </Button>
                <Button onClick={handleTaxInvoice} disabled={taxProcessing}>
                  {taxProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="mr-2 h-4 w-4" />
                  )}
                  발행 완료
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV 업로드 모달 */}
      {csvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl max-h-[80vh] rounded-lg border bg-background p-6 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">CSV 입금 데이터 일괄 매칭</h3>
              <button onClick={() => { setCsvModal(false); setCsvResults(null); }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium mb-1">CSV 형식</p>
                <code className="text-xs">거래처명,금액,입금일</code>
                <br />
                <code className="text-xs text-muted-foreground">
                  삼성전자,5500000,2026-04-01
                </code>
              </div>

              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              {csvUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  매칭 중...
                </div>
              )}

              {csvResults && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    매칭 결과: {csvResults.filter((r) => r.matched).length}/
                    {csvResults.length}건
                  </p>
                  <div className="rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">거래처</th>
                          <th className="px-3 py-2 text-right font-medium">입금액</th>
                          <th className="px-3 py-2 text-left font-medium">매칭</th>
                          <th className="px-3 py-2 text-left font-medium">프로젝트</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvResults.map((r, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-3 py-2">{r.csv_row.company_name}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatKRW(r.csv_row.amount)}
                            </td>
                            <td className="px-3 py-2">
                              {r.matched ? (
                                <span className={`inline-flex items-center gap-1 text-xs ${
                                  r.match_type === "exact"
                                    ? "text-green-600"
                                    : "text-yellow-600"
                                }`}>
                                  <Check className="h-3 w-3" />
                                  {r.match_type === "exact" ? "정확" : "부분"}
                                </span>
                              ) : (
                                <span className="text-xs text-red-500 flex items-center gap-1">
                                  <X className="h-3 w-3" />
                                  실패
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {r.project_name || r.reason || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {csvResults.some((r) => r.matched) && (
                    <div className="flex justify-end">
                      <Button onClick={handleCsvApply} disabled={csvApplying}>
                        {csvApplying ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        매칭된 {csvResults.filter((r) => r.matched).length}건 일괄 적용
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
