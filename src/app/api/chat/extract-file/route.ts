import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

// POST /api/chat/extract-file - 파일에서 텍스트 추출 (pdf-parse, mammoth)
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const fileName = file.name;
  const fileType = file.type;
  const fileSize = file.size;

  if (fileSize > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "파일 크기는 10MB 이하만 가능합니다." }, { status: 400 });
  }

  let extractedText = "";

  try {
    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      // PDF → pdf-parse
      const buffer = Buffer.from(await file.arrayBuffer());
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      extractedText = textResult.text;
      console.log(`[ExtractFile] PDF parsed: ${textResult.total} pages, ${extractedText.length} chars`);
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      // DOCX → mammoth
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
      console.log(`[ExtractFile] DOCX parsed: ${extractedText.length} chars`);
    } else if (fileType.startsWith("image/")) {
      // 이미지 → base64로 변환 (AI Vision에서 사용)
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      return NextResponse.json({
        fileName,
        fileType,
        fileSize,
        extractedText: "",
        imageBase64: `data:${fileType};base64,${base64}`,
        isImage: true,
      });
    } else {
      // TXT, CSV, JSON, MD 등 → 직접 텍스트 읽기
      extractedText = await file.text();
      console.log(`[ExtractFile] Text file read: ${extractedText.length} chars`);
    }

    // 최대 20,000자로 제한
    const maxLen = 20000;
    const truncated = extractedText.length > maxLen;

    return NextResponse.json({
      fileName,
      fileType,
      fileSize,
      extractedText: extractated(extractedText, maxLen),
      truncated,
      isImage: false,
    });
  } catch (error) {
    console.error("[ExtractFile] Error:", error);
    return NextResponse.json({ error: "파일 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

function extractated(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n\n... (이하 생략, 전체 " + text.length + "자)";
}
