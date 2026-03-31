"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  ArrowUpDown,
  FileSignature,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKRW, formatDate, CONTRACT_STATUS_MAP } from "@/lib/format";

type Contract = {
  id: string;
  project_name: string;
  contract_type: string;
  total_amount: number;
  status: string;
  contract_start: string | null;
  contract_end: string | null;
  delivery_deadline: string | null;
  created_at: string;
  clients: { company_name: string; contact_name: string | null } | null;
};

const TABS = [
  { key: "all", label: "전체" },
  { key: "draft", label: "초안" },
  { key: "sent_to_client", label: "발송" },
  { key: "signed", label: "체결" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "완료" },
] as const;

type SortField = "created_at" | "total_amount" | "delivery_deadline";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab !== "all") params.set("status", activeTab);
    if (search) params.set("search", search);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    try {
      const res = await fetch(`/api/contracts?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setContracts(data);
      }
    } catch {
      console.error("Failed to fetch contracts");
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">계약 관리</h1>
          <p className="text-muted-foreground">
            프로젝트 계약을 생성하고 관리합니다.
          </p>
        </div>
        <Link href="/contracts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            새 계약
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        {TABS.map((tab) => (
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
          placeholder="거래처명 또는 프로젝트명으로 검색..."
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
      ) : contracts.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileSignature className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">
            {search ? "검색 결과가 없습니다" : "등록된 계약이 없습니다"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {search
              ? "다른 검색어로 시도해보세요."
              : "새 계약을 추가하여 프로젝트 관리를 시작하세요."}
          </p>
          {!search && (
            <Link href="/contracts/new" className="mt-4 inline-block">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                새 계약
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">
                    거래처
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    프로젝트명
                  </th>
                  <th className="px-4 py-3 text-left font-medium">상태</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <button
                      onClick={() => toggleSort("total_amount")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      계약금액
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      onClick={() => toggleSort("delivery_deadline")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      마감일
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      onClick={() => toggleSort("created_at")}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      등록일
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => {
                  const statusInfo =
                    CONTRACT_STATUS_MAP[contract.status] || CONTRACT_STATUS_MAP.draft;
                  return (
                    <tr
                      key={contract.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="font-medium hover:underline"
                        >
                          {contract.clients?.company_name || "-"}
                        </Link>
                        {contract.clients?.contact_name && (
                          <p className="text-xs text-muted-foreground">
                            {contract.clients.contact_name}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="hover:underline"
                        >
                          {contract.project_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatKRW(contract.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(contract.delivery_deadline)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(contract.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
