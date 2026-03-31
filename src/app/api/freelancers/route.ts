import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/freelancers - 프리랜서 목록
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  let query = supabase
    .from("freelancers")
    .select("*")
    .order("name", { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,specialty.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 계좌번호 마스킹 + 최근 투입 프로젝트 조회
  const freelancers = await Promise.all(
    (data || []).map(async (f: Record<string, unknown>) => {
      // 최근 투입 프로젝트
      const { data: recentAssignment } = await supabase
        .from("freelancer_assignments")
        .select("contracts(project_name)")
        .eq("freelancer_id", f.id as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const contracts = recentAssignment?.contracts as { project_name?: string } | null;

      return {
        ...f,
        account_number_masked: maskAccountNumber(f.account_number as string | null),
        recent_project: contracts?.project_name || null,
      };
    })
  );

  return NextResponse.json(freelancers);
}

// POST /api/freelancers - 프리랜서 추가
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("freelancers")
    .insert({
      name: body.name,
      specialty: body.specialty || null,
      daily_rate: body.daily_rate ? parseInt(body.daily_rate) : null,
      bank_name: body.bank_name || null,
      account_number: body.account_number || null,
      account_holder: body.account_holder || null,
      phone: body.phone || null,
      email: body.email || null,
      tax_type: body.tax_type || "3.3%",
      notes: body.notes || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

function maskAccountNumber(num: string | null): string {
  if (!num) return "-";
  if (num.length <= 4) return num;
  return "****-****-" + num.slice(-4);
}
