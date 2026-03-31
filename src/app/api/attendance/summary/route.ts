import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/attendance/summary?employee_id=x&month=2026-04
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employee_id");
  const month = searchParams.get("month");

  if (!employeeId || !month) {
    return NextResponse.json({ error: "employee_id, month 필수" }, { status: 400 });
  }

  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const end = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;

  const { data } = await supabase
    .from("attendance")
    .select("type")
    .eq("employee_id", employeeId)
    .gte("date", start)
    .lte("date", end);

  const summary: Record<string, number> = {
    present: 0,
    annual_leave: 0,
    half_day: 0,
    sick: 0,
    remote: 0,
    field_work: 0,
  };

  for (const row of data || []) {
    const t = row.type as string;
    summary[t] = (summary[t] || 0) + 1;
  }

  return NextResponse.json(summary);
}
