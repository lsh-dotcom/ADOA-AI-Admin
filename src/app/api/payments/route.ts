import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/payments - 정산 목록 조회
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const overdue = searchParams.get("overdue");

  let query = supabase
    .from("payments")
    .select("*, contracts(project_name, clients(company_name, contact_name))")
    .order("due_date", { ascending: true });

  if (status && status !== "all") {
    if (status === "overdue") {
      // 연체: 미입금 + 입금기한 초과
      query = query
        .in("status", ["pending", "invoiced", "tax_invoice_issued"])
        .lt("due_date", new Date().toISOString().split("T")[0]);
    } else {
      query = query.eq("status", status);
    }
  }

  if (overdue === "true") {
    query = query
      .in("status", ["pending", "invoiced", "tax_invoice_issued"])
      .lt("due_date", new Date().toISOString().split("T")[0]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 연체일수 계산
  const today = new Date();
  const enriched = (data || []).map((p: Record<string, unknown>) => {
    let overdue_days = 0;
    if (
      p.due_date &&
      typeof p.status === "string" &&
      ["pending", "invoiced", "tax_invoice_issued"].includes(p.status)
    ) {
      const due = new Date(p.due_date as string);
      const diff = Math.floor(
        (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
      );
      overdue_days = Math.max(0, diff);
    }
    return { ...p, overdue_days };
  });

  return NextResponse.json(enriched);
}
