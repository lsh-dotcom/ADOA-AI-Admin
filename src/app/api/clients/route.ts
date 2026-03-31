import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET /api/clients - 거래처 목록
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("company_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
