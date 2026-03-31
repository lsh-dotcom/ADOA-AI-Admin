import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/contracts/[id] - 계약 상세 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("contracts")
    .select("*, clients(*)")
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // 정산 내역
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("contract_id", params.id)
    .order("created_at", { ascending: true });

  // 프리랜서 투입
  const { data: assignments } = await supabase
    .from("freelancer_assignments")
    .select("*, freelancers(name, specialty)")
    .eq("contract_id", params.id);

  // 프로젝트 일정
  const { data: schedules } = await supabase
    .from("project_schedules")
    .select("*")
    .eq("contract_id", params.id)
    .order("start_date", { ascending: true });

  return NextResponse.json({
    ...data,
    payments: payments || [],
    assignments: assignments || [],
    schedules: schedules || [],
  });
}

// PATCH /api/contracts/[id] - 계약 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("contracts")
    .update(body)
    .eq("id", params.id)
    .select("*, clients(company_name, contact_name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/contracts/[id] - 계약 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
