import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/attendance?employee_id=x&month=2026-04
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employee_id");
  const month = searchParams.get("month"); // YYYY-MM

  let query = supabase.from("attendance").select("*").order("date", { ascending: true });

  if (employeeId) query = query.eq("employee_id", employeeId);

  if (month) {
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const end = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
    query = query.gte("date", start).lte("date", end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/attendance - upsert
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      {
        employee_id: body.employee_id,
        date: body.date,
        type: body.type,
        note: body.note || null,
      },
      { onConflict: "employee_id,date" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
