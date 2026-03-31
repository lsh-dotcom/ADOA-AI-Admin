import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// POST /api/contracts/[id]/generate-doc - AI로 계약서 텍스트 생성
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, clients(*)")
    .eq("id", params.id)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenRouter API 키가 설정되지 않았습니다." }, { status: 500 });
  }

  const clients = contract.clients as Record<string, unknown> | null;
  const totalAmount = Number(contract.total_amount) || 0;
  const advanceAmount = Number(contract.advance_amount) || 0;
  const balanceAmount = Number(contract.balance_amount) || 0;

  const prompt = `너는 영상 프로덕션 회사 ADOA의 계약서 작성 전문가야.
아래 계약 정보를 바탕으로 공식 계약서 텍스트를 한국어로 작성해줘.

[계약 정보]
- 발주처: ${clients?.company_name || "미정"}
- 부서: ${clients?.department || ""}
- 담당자: ${clients?.contact_name || ""} (${clients?.contact_email || ""})
- 프로젝트명: ${contract.project_name}
- 계약 유형: ${contract.contract_type === "annual" ? "연간 계약" : contract.contract_type === "retainer" ? "리테이너" : "단건 프로젝트"}
- 총 계약금액: ${totalAmount.toLocaleString()}원 (부가세 ${contract.vat_included ? "포함" : "별도"})
- 단가: ${contract.unit_price ? `${Number(contract.unit_price).toLocaleString()}원 × ${contract.quantity}회` : "일괄"}
- 선금: ${advanceAmount > 0 ? `${advanceAmount.toLocaleString()}원 (30%)` : "없음"}
- 잔금: ${balanceAmount.toLocaleString()}원${advanceAmount > 0 ? " (70%)" : ""}
- 계약 기간: ${contract.contract_start || "미정"} ~ ${contract.contract_end || "미정"}
- 납품 마감: ${contract.delivery_deadline || "미정"}

[계약서 형식]
1. 제목: 영상제작 용역 계약서
2. 계약 당사자 (갑: 발주처, 을: ADOA)
3. 계약 목적
4. 용역 범위 및 내용
5. 계약 금액 및 결제 조건
6. 납품 일정
7. 저작권 및 권리
8. 계약 해지
9. 기타 사항
10. 날짜 및 서명란

실무에서 바로 쓸 수 있는 수준으로 작성해.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://adoa-ai-admin.vercel.app",
        "X-Title": "ADOA AI Admin",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("[GenerateDoc] OpenRouter error:", res.status, errorBody);
      return NextResponse.json({ error: `AI 서비스 오류 (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const docText = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ document: docText });
  } catch (error) {
    console.error("[GenerateDoc] Error:", error);
    return NextResponse.json({ error: "계약서 생성 실패" }, { status: 500 });
  }
}
