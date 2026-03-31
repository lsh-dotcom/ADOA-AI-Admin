import { NextRequest, NextResponse } from "next/server";

const ROUTER_PROMPT = `너는 ADOA의 AI 경영지원 라우터야.
PM의 입력을 분석해서 어떤 에이전트가 처리해야 하는지 판단하고, 바로 처리 결과를 응답해.

에이전트 역할:
- contract: 계약서 작성, 수정, 조회, 거래처
- billing: 정산, 입금, 세금계산서, 매출
- freelancer: 프리랜서 투입, 비용, 지급
- schedule: 프로젝트 일정, 촬영, 편집
- hr: 인사, 근태, 연차
- general: 일반 질문

[결제조건 규칙]
- 총액 300만원 이상: 선금 30% + 잔금 70%
- 총액 300만원 미만: 전액 납품 후
- 부가세는 별도가 기본
- 금액은 원 단위 숫자로. "500만원" → 5000000

[계약 관련 입력이면]
자연어에서 계약 정보를 추출해서 요약해.
거래처, 프로젝트명, 금액, 기간, 결제조건을 정리.

반드시 아래 JSON 형식으로만 응답:
{
  "agent": "에이전트명",
  "intent": "의도 설명",
  "response": "사용자에게 보여줄 한국어 응답 (마크다운 가능)",
  "contract_data": null 또는 {
    "client_name": "",
    "project_name": "",
    "unit_price": 0,
    "quantity": 1,
    "total_amount": 0,
    "vat_included": false,
    "advance_amount": 0,
    "balance_amount": 0,
    "contract_start": "",
    "contract_end": "",
    "notes": ""
  }
}`;

// POST /api/chat/send - Supabase 없이 직접 OpenRouter 호출
export async function POST(request: NextRequest) {
  const { message, history } = await request.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      agent: "system",
      response: "OpenRouter API 키가 설정되지 않았습니다.\n\n`.env.local` 파일에 `OPENROUTER_API_KEY`를 추가해주세요.",
      contract_data: null,
    });
  }

  // Build message history
  const messages = [
    { role: "system", content: ROUTER_PROMPT },
    ...(history || []).slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  try {
    console.log("[ChatSend] Calling OpenRouter...");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://adoa-ai-admin.vercel.app",
        "X-Title": "ADOA AI Admin",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("[ChatSend] OpenRouter error:", res.status, errorBody);
      return NextResponse.json({
        agent: "system",
        response: `AI 서비스 오류 (${res.status}). 잠시 후 다시 시도해주세요.\n\n\`\`\`\n${errorBody.slice(0, 200)}\n\`\`\``,
        contract_data: null,
      });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    console.log("[ChatSend] Raw response:", raw.slice(0, 300));

    // Try to parse as JSON
    const parsed = tryParseJSON(raw);

    if (parsed && parsed.response) {
      return NextResponse.json({
        agent: parsed.agent || "general",
        response: parsed.response,
        contract_data: parsed.contract_data || null,
      });
    }

    // If not JSON, return raw text
    return NextResponse.json({
      agent: "general",
      response: raw,
      contract_data: null,
    });
  } catch (error) {
    console.error("[ChatSend] Error:", error);
    return NextResponse.json({
      agent: "system",
      response: "AI 서비스에 연결할 수 없습니다. 네트워크를 확인해주세요.",
      contract_data: null,
    });
  }
}

function tryParseJSON(text: string) {
  // Direct parse
  try { return JSON.parse(text); } catch { /* continue */ }
  // Extract from ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* continue */ }
  }
  // Extract first { ... } block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* continue */ }
  }
  return null;
}
