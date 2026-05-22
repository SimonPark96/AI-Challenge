import { NextResponse } from "next/server";
import { processQuote } from "@/lib/quote/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5분 — OpenAI Assistants poll 대비

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
    const result = await processQuote(file, file.name, file.size);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, fileName: file.name },
      { status: 500 }
    );
  }
}
