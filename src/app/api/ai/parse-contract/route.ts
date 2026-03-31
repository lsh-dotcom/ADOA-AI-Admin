import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `너는 영상 프로덕션 회사 ADOA의 계약 정보 파싱 전문가야.
사용자가 입력한 자연어 텍스트에서 계약 관련 정보를 추출해서 JSON으로 반환해.

[결제조건 규칙]
- 총액 300만원 이상: 선금 30% + 잔금 70%
- 총액 300만원 미만: 전액 납품 후
- 부가세는 별도가 기본

[계약 유형 판단]
- 연간/년 단위 계약 → "annual"
- 월정액/리테이너 → "retainer"
- 그 외 단건 → "project"

[출력 JSON 형식]
{
  "client": { "company_name": "", "department": "", "contact_name": "", "contact_email": "", "contact_phone": "" },
  "project_name": "",
  "contract_type": "project",
  "unit_price": 0,
  "quantity": 1,
  "total_amount": 0,
  "vat_included": false,
  "advance_amount": 0,
  "balance_amount": 0,
  "contract_start": "YYYY-MM-DD",
  "contract_end": "YYYY-MM-DD",
  "delivery_deadline": "YYYY-MM-DD",
  "notes": "",
  "missing_info": []
}

추출할 수 없는 정보는 null로, missing_info에 누락 항목을 한국어로 설명해.
금액은 반드시 숫자(원 단위)로 변환해. 예: "500만원" → 5000000
날짜는 YYYY-MM-DD 형식으로. 연도가 없으면 2026년으로 가정해.`;

export async function POST(request: NextRequest) {
  const { text } = await request.json();

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "파싱할 텍스트를 입력해주세요." },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenRouter API 키가 설정되지 않았습니다. 설정 > API 연동에서 키를 입력해주세요." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4-20250514",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenRouter API error:", response.status, errorBody);
      return NextResponse.json(
        { error: `AI 서비스 오류 (${response.status}). 잠시 후 다시 시도해주세요.` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log("[ParseContract] response:", content?.slice(0, 300));

    if (!content) {
      console.error("[ParseContract] Empty response from OpenRouter:", JSON.stringify(data));
      return NextResponse.json(
        { error: "AI 응답을 받지 못했습니다." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("AI parse error:", error);
    return NextResponse.json(
      { error: "AI 파싱 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
