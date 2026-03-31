import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const search = new URL(request.url).searchParams.get("search");

  let query = supabase
    .from("employees")
    .select("*")
    .order("name", { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,department.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("employees")
    .insert({
      name: body.name,
      position: body.position || null,
      department: body.department || null,
      hire_date: body.hire_date || null,
      contract_type: body.contract_type || "full_time",
      probation_end_date: body.probation_end_date || null,
      salary: body.salary ? parseInt(body.salary) : null,
      bank_account: body.bank_account || null,
      phone: body.phone || null,
      email: body.email || null,
      emergency_contact: body.emergency_contact || null,
      annual_leave_total: body.annual_leave_total ?? 15,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
