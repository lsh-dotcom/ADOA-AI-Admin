import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/contracts - 계약 목록 조회
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? true : false;

  let query = supabase
    .from("contracts")
    .select("*, clients(company_name, contact_name)")
    .order(sortBy, { ascending: sortOrder });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(
      `project_name.ilike.%${search}%,clients.company_name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/contracts - 새 계약 생성
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();

  // 거래처 처리: 기존 거래처 선택 또는 신규 생성
  let clientId = body.client_id;

  if (!clientId && body.client) {
    // 회사명으로 기존 거래처 검색
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("company_name", body.client.company_name)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
      // 기존 거래처 정보 업데이트
      const updateData: Record<string, string> = {};
      if (body.client.contact_name)
        updateData.contact_name = body.client.contact_name;
      if (body.client.contact_email)
        updateData.contact_email = body.client.contact_email;
      if (body.client.contact_phone)
        updateData.contact_phone = body.client.contact_phone;
      if (body.client.department)
        updateData.department = body.client.department;

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from("clients")
          .update(updateData)
          .eq("id", clientId);
      }
    } else {
      // 신규 거래처 생성
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          company_name: body.client.company_name,
          department: body.client.department || null,
          contact_name: body.client.contact_name || null,
          contact_email: body.client.contact_email || null,
          contact_phone: body.client.contact_phone || null,
        })
        .select("id")
        .single();

      if (clientError) {
        return NextResponse.json(
          { error: `거래처 생성 실패: ${clientError.message}` },
          { status: 500 }
        );
      }
      clientId = newClient.id;
    }
  }

  // 계약 생성
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      client_id: clientId,
      project_name: body.project_name,
      contract_type: body.contract_type || "project",
      unit_price: body.unit_price || null,
      quantity: body.quantity || 1,
      total_amount: body.total_amount,
      vat_included: body.vat_included ?? false,
      contract_start: body.contract_start || null,
      contract_end: body.contract_end || null,
      delivery_deadline: body.delivery_deadline || null,
      status: "draft",
      ai_generated: body.ai_generated ?? false,
      created_by: body.created_by || null,
    })
    .select("*, clients(company_name, contact_name)")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `계약 생성 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
