import { NextRequest, NextResponse } from "next/server";

// POST /api/chat/extract-file - 파일에서 텍스트 추출
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const fileName = file.name;
  const fileType = file.type;
  const fileSize = file.size;

  // 10MB 제한
  if (fileSize > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "파일 크기는 10MB 이하만 가능합니다." }, { status: 400 });
  }

  let extractedText = "";

  try {
    if (fileType === "application/pdf") {
      // PDF → 바이너리를 AI에게 직접 보내서 내용 추출
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      extractedText = await extractWithAI(fileName, base64, "pdf");
    } else if (fileType.startsWith("image/")) {
      // 이미지 → AI vision으로 텍스트 추출
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      extractedText = await extractWithAI(fileName, base64, "image", fileType);
    } else if (
      fileType === "text/plain" ||
      fileType === "text/csv" ||
      fileType === "application/json" ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".md")
    ) {
      // 텍스트 파일 → 직접 읽기
      extractedText = await file.text();
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      // DOCX → 바이너리를 AI에게 보내서 추출
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      extractedText = await extractWithAI(fileName, base64, "document");
    } else {
      // 기타 → 텍스트로 시도
      try {
        extractedText = await file.text();
      } catch {
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식입니다: ${fileType}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      fileName,
      fileType,
      fileSize,
      extractedText: extractedText.slice(0, 15000), // 최대 15000자
      truncated: extractedText.length > 15000,
    });
  } catch (error) {
    console.error("[ExtractFile] Error:", error);
    return NextResponse.json({ error: "파일 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

async function extractWithAI(
  fileName: string,
  base64Data: string,
  type: "pdf" | "image" | "document",
  mimeType?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return `[파일: ${fileName}] - OpenRouter API 키가 설정되지 않아 내용을 추출할 수 없습니다.`;
  }

  const systemPrompt = `너는 문서/이미지에서 텍스트를 추출하는 전문가야.
파일의 내용을 정확하게 텍스트로 변환해줘.
계약서, 견적서, 세금계산서 등 비즈니스 문서인 경우 핵심 정보(거래처, 금액, 날짜, 조건 등)를 구조화해서 정리해.
표가 있으면 표 형태를 유지해.
원문의 내용을 빠뜨리지 말고 최대한 정확하게 추출해.`;

  // For images, use vision API
  if (type === "image") {
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
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `이 이미지(${fileName})의 텍스트 내용을 추출해줘.` },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType || "image/png"};base64,${base64Data}` },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[ExtractFile] Vision API error:", res.status, err);
      return `[파일: ${fileName}] - AI 텍스트 추출 실패 (${res.status})`;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || `[파일: ${fileName}] - 추출된 내용 없음`;
  }

  // For PDF/DOCX, send as base64 with description
  // Note: Claude via OpenRouter can handle PDFs when sent as part of the message
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
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `첨부된 ${type === "pdf" ? "PDF" : "문서"} 파일(${fileName})의 내용을 추출해줘.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:application/pdf;base64,${base64Data}` },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[ExtractFile] Doc API error:", res.status, err);
    // Fallback: return file metadata
    return `[첨부 파일: ${fileName}] (${type}, ${Math.round(base64Data.length * 0.75 / 1024)}KB)\n\nAI 추출 실패 - 파일 내용을 직접 입력해주세요.`;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || `[파일: ${fileName}] - 추출된 내용 없음`;
}
