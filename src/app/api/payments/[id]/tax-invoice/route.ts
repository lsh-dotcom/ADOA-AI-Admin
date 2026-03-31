import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// POST /api/payments/[id]/tax-invoice - 세금계산서 발행 완료 처리
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { tax_invoice_date } = await request.json();

  const dateStr = tax_invoice_date || new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("payments")
    .update({
      tax_invoice_date: dateStr,
      status: "confirmed",
    })
    .eq("id", params.id)
    .select("*, contracts(project_name, clients(company_name))")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
