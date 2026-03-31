"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserCheck,
  Plus,
  Search,
  Loader2,
  Edit3,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKRW } from "@/lib/format";
import { useRealtimeSubscription } from "@/hooks/use-realtime";

type Freelancer = {
  id: string;
  name: string;
  specialty: string | null;
  daily_rate: number | null;
  bank_name: string | null;
  account_number: string | null;
  account_number_masked: string;
  account_holder: string | null;
  phone: string | null;
  email: string | null;
  tax_type: string;
  notes: string | null;
  recent_project: string | null;
};

type FreelancerForm = {
  name: string;
  specialty: string;
  daily_rate: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  phone: string;
  email: string;
  tax_type: string;
  notes: string;
};

const emptyForm: FreelancerForm = {
  name: "",
  specialty: "",
  daily_rate: "",
  bank_name: "",
  account_number: "",
  account_holder: "",
  phone: "",
  email: "",
  tax_type: "3.3%",
  notes: "",
};

const SPECIALTIES = [
  "촬영감독",
  "조명",
  "편집",
  "모델",
  "작가/구성",
  "음향",
  "그래픽",
  "드론",
  "스타일리스트",
  "기타",
];

export default function FreelancersPage() {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<FreelancerForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchFreelancers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/freelancers?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setFreelancers(data);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchFreelancers();
  }, [fetchFreelancers]);

  useRealtimeSubscription("freelancers", fetchFreelancers);

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal("add");
  };

  const openEdit = (f: Freelancer) => {
    setForm({
      name: f.name,
      specialty: f.specialty || "",
      daily_rate: f.daily_rate ? String(f.daily_rate) : "",
      bank_name: f.bank_name || "",
      account_number: f.account_number || "",
      account_holder: f.account_holder || "",
      phone: f.phone || "",
      email: f.email || "",
      tax_type: f.tax_type || "3.3%",
      notes: f.notes || "",
    });
    setEditId(f.id);
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const url = editId ? `/api/freelancers/${editId}` : "/api/freelancers";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setModal(null);
        await fetchFreelancers();
      } else {
        const err = await res.json();
        alert(err.error || "저장에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/freelancers/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchFreelancers();
      } else {
        alert("삭제에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    }
    setDeleting(null);
  };

  const updateField = (field: keyof FreelancerForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">프리랜서 관리</h1>
          <p className="text-muted-foreground">프리랜서 정보와 투입/정산을 관리합니다.</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          프리랜서 등록
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="이름 또는 전문분야로 검색..."
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
      ) : freelancers.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">등록된 프리랜서가 없습니다</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            프리랜서를 등록하여 투입 관리를 시작하세요.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">이름</th>
                  <th className="px-4 py-3 text-left font-medium">전문분야</th>
                  <th className="px-4 py-3 text-right font-medium">일당</th>
                  <th className="px-4 py-3 text-left font-medium">계좌</th>
                  <th className="px-4 py-3 text-left font-medium">연락처</th>
                  <th className="px-4 py-3 text-left font-medium">최근 프로젝트</th>
                  <th className="px-4 py-3 text-left font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {freelancers.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3">
                      {f.specialty && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {f.specialty}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatKRW(f.daily_rate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {f.bank_name && `${f.bank_name} `}
                      {f.account_number_masked}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{f.phone || f.email || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {f.recent_project || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(f)}
                          className="rounded p-1 hover:bg-muted transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(f.id)}
                          disabled={deleting === f.id}
                          className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          {deleting === f.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
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

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[85vh] rounded-lg border bg-background p-6 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {modal === "add" ? "프리랜서 등록" : "프리랜서 수정"}
              </h3>
              <button onClick={() => setModal(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">이름 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">전문분야</label>
                  <select
                    value={form.specialty}
                    onChange={(e) => updateField("specialty", e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">선택...</option>
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">일당 (원)</label>
                  <input
                    type="number"
                    value={form.daily_rate}
                    onChange={(e) => updateField("daily_rate", e.target.value)}
                    placeholder="500000"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">원천세 유형</label>
                  <select
                    value={form.tax_type}
                    onChange={(e) => updateField("tax_type", e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="3.3%">3.3% (사업소득)</option>
                    <option value="8.8%">8.8% (기타소득)</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">계좌 정보</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">은행</label>
                    <input
                      value={form.bank_name}
                      onChange={(e) => updateField("bank_name", e.target.value)}
                      placeholder="국민은행"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">계좌번호</label>
                    <input
                      value={form.account_number}
                      onChange={(e) => updateField("account_number", e.target.value)}
                      placeholder="123456789012"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">예금주</label>
                    <input
                      value={form.account_holder}
                      onChange={(e) => updateField("account_holder", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">연락처</label>
                  <input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="010-1234-5678"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">이메일</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">비고</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setModal(null)}>취소</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {modal === "add" ? "등록" : "저장"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
