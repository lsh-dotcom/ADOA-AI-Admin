import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";

  let query = supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH - mark as read
export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient();
  const { ids } = await request.json();

  if (Array.isArray(ids) && ids.length > 0) {
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  } else {
    // Mark all as read
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  }

  return NextResponse.json({ success: true });
}
