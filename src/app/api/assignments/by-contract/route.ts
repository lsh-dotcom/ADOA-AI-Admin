import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/assignments/by-contract?contract_id=xxx
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const contractId = new URL(request.url).searchParams.get("contract_id");

  if (!contractId) {
    return NextResponse.json({ error: "contract_id 필수" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("freelancer_assignments")
    .select("*, freelancers(name, specialty, bank_name, account_number, account_holder)")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 계좌번호 마스킹
  const masked = (data || []).map((a: Record<string, unknown>) => {
    const freelancers = a.freelancers as Record<string, unknown> | null;
    if (freelancers?.account_number) {
      const num = freelancers.account_number as string;
      freelancers.account_number_masked =
        num.length > 4 ? "****-****-" + num.slice(-4) : num;
    }
    return { ...a, freelancers };
  });

  return NextResponse.json(masked);
}
