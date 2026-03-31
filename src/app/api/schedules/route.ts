import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/schedules - 전체 일정 조회
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contract_id");
  const view = searchParams.get("view"); // 'week' | 'month'

  let query = supabase
    .from("project_schedules")
    .select("*, contracts(project_name, clients(company_name))")
    .order("start_date", { ascending: true });

  if (contractId) {
    query = query.eq("contract_id", contractId);
  }

  if (view === "week") {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    query = query
      .lte("start_date", weekEnd.toISOString().split("T")[0])
      .gte("end_date", now.toISOString().split("T")[0]);
  } else if (view === "month") {
    const now = new Date();
    const monthEnd = new Date(now);
    monthEnd.setDate(monthEnd.getDate() + 30);
    query = query
      .lte("start_date", monthEnd.toISOString().split("T")[0])
      .gte("end_date", now.toISOString().split("T")[0]);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 지연 상태 계산
  const today = new Date().toISOString().split("T")[0];
  const enriched = (data || []).map((s: Record<string, unknown>) => {
    let computedStatus = s.status as string;
    if (s.status === "pending" && s.end_date && (s.end_date as string) < today) {
      computedStatus = "delayed";
    }
    return { ...s, computed_status: computedStatus };
  });

  return NextResponse.json(enriched);
}

// POST /api/schedules - 일정 수동 추가
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("project_schedules")
    .insert({
      contract_id: body.contract_id,
      phase: body.phase || "custom",
      phase_name: body.phase_name,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      status: body.status || "pending",
      assigned_to: body.assigned_to || null,
      notes: body.notes || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
