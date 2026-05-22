import { NextResponse } from "next/server";
import { parseQuoteWithOpenAI } from "@/lib/openai/parse-quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 견적서 파일 파싱만 수행. DB 저장 없음.
 * /request 페이지에서 업로드 직후 미리보기 자동 채움 용도.
 *
 * Body: multipart/form-data with `file`
 * Response: ParsedQuote
 */
export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "multipart/form-data 가 필요합니다." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "'file' 필드에 파일이 필요합니다." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "빈 파일입니다." }, { status: 400 });
  }

  try {
    const parsed = await parseQuoteWithOpenAI(file);
    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      ...parsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, fileName: file.name },
      { status: 500 }
    );
  }
}
