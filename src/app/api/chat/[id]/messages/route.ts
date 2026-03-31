/* eslint-disable @typescript-eslint/no-unused-vars */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/chat/[id]/messages
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/chat/[id]/messages - 메시지 전송 + AI 처리
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { content } = await request.json();
  const conversationId = params.id;

  if (!content?.trim()) {
    return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  // 1. 사용자 메시지 저장
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content,
  });

  // 2. 라우터 상태 메시지
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "status",
    content: "라우터가 분석 중...",
    agent: "router",
  });

  // 대화 제목 업데이트 (첫 메시지인 경우)
  const { data: msgCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("role", "user");

  if (msgCount && (msgCount as unknown[]).length <= 1) {
    const title = content.length > 30 ? content.slice(0, 30) + "..." : content;
    await supabase
      .from("conversations")
      .update({ title, last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  } else {
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  // 3. 라우터 호출
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    await deleteLastStatus(supabase, conversationId);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: "OpenRouter API 키가 설정되지 않았습니다. 설정 > API 연동에서 키를 입력해주세요.",
    });
    return NextResponse.json({ ok: true });
  }

  let routerResult: { agent: string; intent: string; extracted_data: Record<string, unknown> };

  try {
    routerResult = await callRouter(apiKey, content);
  } catch {
    await deleteLastStatus(supabase, conversationId);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: "AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
    });
    return NextResponse.json({ ok: true });
  }

  // 4. 라우터 상태 업데이트 → 에이전트 상태
  await deleteLastStatus(supabase, conversationId);

  const agentLabels: Record<string, string> = {
    contract: "계약 에이전트",
    billing: "정산 에이전트",
    freelancer: "프리랜서 에이전트",
    schedule: "일정 에이전트",
    hr: "인사 에이전트",
    general: "일반 어시스턴트",
  };
  const agentLabel = agentLabels[routerResult.agent] || "AI 어시스턴트";

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "status",
    content: `${agentLabel} 처리 중...`,
    agent: routerResult.agent,
  });

  // 5. 에이전트별 처리
  let agentResponse: { content: string; metadata?: Record<string, unknown> };

  try {
    agentResponse = await executeAgent(
      apiKey,
      supabase,
      routerResult.agent,
      routerResult.intent,
      routerResult.extracted_data,
      content
    );
  } catch {
    agentResponse = { content: "처리 중 오류가 발생했습니다. 다시 시도해주세요." };
  }

  // 6. 최종 응답 저장
  await deleteLastStatus(supabase, conversationId);

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: agentResponse.content,
    agent: routerResult.agent,
    metadata: agentResponse.metadata || null,
  });

  return NextResponse.json({ ok: true });
}

// ---- Helper functions ----

async function deleteLastStatus(
  supabase: ReturnType<typeof createAdminClient>,
  conversationId: string
) {
  const { data } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("role", "status")
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    await supabase.from("messages").delete().eq("id", (data[0] as { id: string }).id);
  }
}

const ROUTER_PROMPT = `너는 ADOA의 AI 경영지원 라우터야.
PM의 입력을 분석해서 어떤 에이전트가 처리해야 하는지 판단해.

에이전트 목록:
- contract: 계약서 작성, 수정, 조회, 거래처 관련
- billing: 정산, 입금, 세금계산서, 매출 관련
- freelancer: 프리랜서 투입, 비용, 지급, 인력 관련
- schedule: 프로젝트 일정, 촬영, 편집, 납품 마감 관련
- hr: 인사, 근태, 연차, 급여 관련
- general: 일반 질문, 업무 조언, 그 외

반드시 JSON으로만 응답:
{ "agent": "에이전트명", "intent": "의도 설명", "extracted_data": { 추출된 정보 } }`;

async function callRouter(apiKey: string, userMessage: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-20250514",
      messages: [
        { role: "system", content: ROUTER_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`Router API error: ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function executeAgent(
  apiKey: string,
  supabase: ReturnType<typeof createAdminClient>,
  agent: string,
  intent: string,
  extractedData: Record<string, unknown>,
  originalMessage: string
): Promise<{ content: string; metadata?: Record<string, unknown> }> {
  switch (agent) {
    case "contract":
      return handleContractAgent(apiKey, supabase, intent, extractedData, originalMessage);
    case "billing":
      return handleBillingAgent(apiKey, supabase, intent, extractedData, originalMessage);
    case "freelancer":
      return handleFreelancerAgent(apiKey, supabase, intent, extractedData, originalMessage);
    case "schedule":
      return handleScheduleAgent(supabase, intent, extractedData);
    case "hr":
      return handleHRAgent(supabase, intent, extractedData);
    default:
      return handleGeneralAgent(apiKey, originalMessage);
  }
}

// -- Contract Agent --
async function handleContractAgent(
  apiKey: string,
  supabase: ReturnType<typeof createAdminClient>,
  intent: string,
  extractedData: Record<string, unknown>,
  originalMessage: string
) {
  // 조회 의도
  if (intent.includes("조회") || intent.includes("확인") || intent.includes("검색")) {
    const search = (extractedData.company_name || extractedData.project_name || "") as string;
    const { data } = await supabase
      .from("contracts")
      .select("*, clients(company_name)")
      .or(`project_name.ilike.%${search}%,clients.company_name.ilike.%${search}%`)
      .limit(5);

    if (!data || data.length === 0) {
      return { content: `"${search}" 관련 계약을 찾을 수 없습니다.` };
    }

    return {
      content: `${data.length}건의 계약을 찾았습니다.`,
      metadata: {
        type: "contract_list",
        contracts: data.map((c: Record<string, unknown>) => ({
          id: c.id,
          project_name: c.project_name,
          company_name: (c.clients as Record<string, unknown>)?.company_name || "",
          total_amount: c.total_amount,
          status: c.status,
        })),
      },
    };
  }

  // 생성 의도 → AI 파싱
  const parseRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-20250514",
      messages: [
        {
          role: "system",
          content: `너는 영상 프로덕션 회사 ADOA의 계약 정보 파싱 전문가야.
자연어에서 계약 정보를 추출해 JSON으로 반환해.
결제조건: 300만원 이상 선금30%+잔금70%, 미만 전액 납품 후. 부가세 별도 기본.
날짜 연도 없으면 2026년. 금액은 원 단위 숫자.
{
  "client": { "company_name":"", "department":"", "contact_name":"", "contact_email":"", "contact_phone":"" },
  "project_name":"", "contract_type":"project", "unit_price":0, "quantity":1,
  "total_amount":0, "vat_included":false, "contract_start":"YYYY-MM-DD",
  "contract_end":"YYYY-MM-DD", "delivery_deadline":"YYYY-MM-DD",
  "notes":"", "missing_info":[]
}`,
        },
        { role: "user", content: originalMessage },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!parseRes.ok) {
    return { content: "계약 정보 분석에 실패했습니다. 다시 시도해주세요." };
  }

  const parseData = await parseRes.json();
  const parsed = JSON.parse(parseData.choices[0].message.content);

  // DB에 초안 생성
  let clientId = null;
  if (parsed.client?.company_name) {
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("company_name", parsed.client.company_name)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient } = await supabase
        .from("clients")
        .insert(parsed.client)
        .select("id")
        .single();
      clientId = newClient?.id;
    }
  }

  const { data: contract } = await supabase
    .from("contracts")
    .insert({
      client_id: clientId,
      project_name: parsed.project_name || "새 프로젝트",
      contract_type: parsed.contract_type || "project",
      unit_price: parsed.unit_price || null,
      quantity: parsed.quantity || 1,
      total_amount: parsed.total_amount || 0,
      vat_included: parsed.vat_included ?? false,
      contract_start: parsed.contract_start || null,
      contract_end: parsed.contract_end || null,
      delivery_deadline: parsed.delivery_deadline || null,
      status: "draft",
      ai_generated: true,
    })
    .select("*, clients(company_name)")
    .single();

  const totalAmount = parsed.total_amount || 0;
  const isOver3M = totalAmount >= 3000000;
  const advanceAmount = isOver3M ? Math.round(totalAmount * 0.3) : 0;
  const balanceAmount = isOver3M ? totalAmount - advanceAmount : totalAmount;

  let paymentInfo = "전액 납품 후 결제";
  if (isOver3M) {
    paymentInfo = `선금 30% (${advanceAmount.toLocaleString()}원) + 잔금 70% (${balanceAmount.toLocaleString()}원)`;
  }

  const missingText = parsed.missing_info?.length > 0
    ? `\n\n⚠️ 누락 정보: ${parsed.missing_info.join(", ")}`
    : "";

  return {
    content: `계약서 초안이 생성되었습니다.

**${parsed.client?.company_name || "거래처 미지정"}** - ${parsed.project_name || "프로젝트"}
- 금액: ${totalAmount.toLocaleString()}원 (부가세 ${parsed.vat_included ? "포함" : "별도"})
- 결제: ${paymentInfo}
- 기간: ${parsed.contract_start || "미정"} ~ ${parsed.contract_end || "미정"}${missingText}`,
    metadata: {
      type: "contract_created",
      contract_id: contract?.id,
      actions: [
        { label: "확인하기", href: `/contracts/${contract?.id}` },
        { label: "수정", href: `/contracts/${contract?.id}` },
      ],
    },
  };
}

// -- Billing Agent --
async function handleBillingAgent(
  _apiKey: string,
  supabase: ReturnType<typeof createAdminClient>,
  intent: string,
  _extractedData: Record<string, unknown>,
  _originalMessage: string
) {
  if (intent.includes("현황") || intent.includes("요약") || intent.includes("매출")) {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data: paid } = await supabase.from("payments").select("total_with_vat")
      .in("status", ["paid", "confirmed"]).gte("paid_date", firstOfMonth).lte("paid_date", lastOfMonth);
    const revenue = (paid || []).reduce((s: number, p: { total_with_vat: number | null }) => s + (Number(p.total_with_vat) || 0), 0);

    const { data: unpaid } = await supabase.from("payments").select("total_with_vat")
      .in("status", ["pending", "invoiced", "tax_invoice_issued"]);
    const totalUnpaid = (unpaid || []).reduce((s: number, p: { total_with_vat: number | null }) => s + (Number(p.total_with_vat) || 0), 0);

    const todayStr = today.toISOString().split("T")[0];
    const { data: overdueItems } = await supabase.from("payments").select("id")
      .in("status", ["pending", "invoiced", "tax_invoice_issued"]).lt("due_date", todayStr);

    return {
      content: `**${today.getMonth() + 1}월 정산 현황**\n\n- 이번 달 매출: ${revenue.toLocaleString()}원\n- 미수금 총액: ${totalUnpaid.toLocaleString()}원\n- 연체 건수: ${(overdueItems || []).length}건`,
      metadata: {
        type: "billing_summary",
        actions: [{ label: "정산 관리로 이동", href: "/billing" }],
      },
    };
  }

  return {
    content: "정산 관련 요청을 처리했습니다.",
    metadata: { type: "billing_info", actions: [{ label: "정산 관리", href: "/billing" }] },
  };
}

// -- Freelancer Agent --
async function handleFreelancerAgent(
  _apiKey: string,
  supabase: ReturnType<typeof createAdminClient>,
  intent: string,
  extractedData: Record<string, unknown>,
  _originalMessage: string
) {
  if (intent.includes("조회") || intent.includes("검색") || intent.includes("찾")) {
    const search = (extractedData.name || extractedData.specialty || "") as string;
    const { data } = await supabase.from("freelancers").select("*")
      .or(`name.ilike.%${search}%,specialty.ilike.%${search}%`).limit(10);

    if (!data || data.length === 0) {
      return { content: `"${search}" 관련 프리랜서를 찾을 수 없습니다.` };
    }

    const list = data.map((f: Record<string, unknown>) =>
      `- **${f.name}** (${f.specialty || "분야 미지정"}) - 일당 ${(Number(f.daily_rate) || 0).toLocaleString()}원`
    ).join("\n");

    return {
      content: `${data.length}명의 프리랜서를 찾았습니다.\n\n${list}`,
      metadata: { type: "freelancer_list", actions: [{ label: "프리랜서 관리", href: "/freelancers" }] },
    };
  }

  return {
    content: "프리랜서 관련 요청을 처리했습니다.",
    metadata: { type: "freelancer_info", actions: [{ label: "프리랜서 관리", href: "/freelancers" }] },
  };
}

// -- Schedule Agent --
async function handleScheduleAgent(
  supabase: ReturnType<typeof createAdminClient>,
  intent: string,
  _extractedData: Record<string, unknown>
) {
  if (intent.includes("이번 주") || intent.includes("일정") || intent.includes("마감")) {
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data } = await supabase.from("project_schedules")
      .select("*, contracts(project_name)")
      .lte("start_date", weekEnd.toISOString().split("T")[0])
      .gte("end_date", today.toISOString().split("T")[0])
      .neq("status", "completed")
      .order("end_date", { ascending: true });

    if (!data || data.length === 0) {
      return { content: "이번 주 예정된 일정이 없습니다." };
    }

    const list = data.map((s: Record<string, unknown>) => {
      const contracts = s.contracts as { project_name?: string } | null;
      return `- **${contracts?.project_name}** - ${s.phase_name} (~ ${s.end_date})`;
    }).join("\n");

    return {
      content: `이번 주 일정 ${data.length}건:\n\n${list}`,
      metadata: { type: "schedule_list", actions: [{ label: "일정 관리", href: "/schedules" }] },
    };
  }

  return {
    content: "일정 관련 요청을 처리했습니다.",
    metadata: { type: "schedule_info", actions: [{ label: "일정 관리", href: "/schedules" }] },
  };
}

// -- HR Agent --
async function handleHRAgent(
  supabase: ReturnType<typeof createAdminClient>,
  intent: string,
  _extractedData: Record<string, unknown>
) {
  if (intent.includes("연차") || intent.includes("현황")) {
    const { data } = await supabase.from("employees").select("name, annual_leave_total, annual_leave_used")
      .eq("status", "active");

    if (!data || data.length === 0) return { content: "등록된 직원이 없습니다." };

    const list = data.map((e: Record<string, unknown>) =>
      `- **${e.name}**: 잔여 ${Number(e.annual_leave_total) - Number(e.annual_leave_used)}일 / ${e.annual_leave_total}일`
    ).join("\n");

    return {
      content: `직원 연차 현황:\n\n${list}`,
      metadata: { type: "hr_info", actions: [{ label: "인사 관리", href: "/hr" }] },
    };
  }

  return {
    content: "인사 관련 요청을 처리했습니다.",
    metadata: { type: "hr_info", actions: [{ label: "인사 관리", href: "/hr" }] },
  };
}

// -- General Agent --
async function handleGeneralAgent(apiKey: string, message: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-20250514",
      messages: [
        {
          role: "system",
          content: "너는 영상 프로덕션 회사 ADOA의 AI 경영지원 어시스턴트야. 한국어로 친절하고 전문적으로 답변해.",
        },
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) return { content: "응답을 생성할 수 없습니다." };
  const data = await res.json();
  return { content: data.choices[0].message.content };
}
