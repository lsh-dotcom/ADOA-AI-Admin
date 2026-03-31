import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// POST /api/assignments/approve - 프리랜서 지급 승인
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const { assignment_ids, action } = await request.json();

  // action: 'approve' | 'hold' | 'paid'
  if (!Array.isArray(assignment_ids) || assignment_ids.length === 0) {
    return NextResponse.json({ error: "선택된 항목이 없습니다." }, { status: 400 });
  }

  let newStatus: string;
  const updateData: Record<string, unknown> = {};

  switch (action) {
    case "approve":
      newStatus = "approved";
      break;
    case "paid":
      newStatus = "paid";
      updateData.paid_date = new Date().toISOString().split("T")[0];
      break;
    case "hold":
      // 보류는 client_paid 상태 유지
      return NextResponse.json({ success: true, message: "보류 처리되었습니다." });
    default:
      return NextResponse.json({ error: "유효하지 않은 액션" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("freelancer_assignments")
    .update({ payment_status: newStatus, ...updateData })
    .in("id", assignment_ids)
    .select("*, freelancers(name)");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: data?.length || 0 });
}
