import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseQuoteWithOpenAI } from "@/lib/openai/parse-quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bidRequestId = Number(id);
  if (!Number.isInteger(bidRequestId) || bidRequestId <= 0) {
    return NextResponse.json({ error: "잘못된 id" }, { status: 400 });
  }

  const bidRequest = await prisma.bidRequest.findUnique({
    where: { id: bidRequestId },
  });
  if (!bidRequest) {
    return NextResponse.json({ error: "견적 요청을 찾을 수 없습니다." }, { status: 404 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "multipart/form-data 필요" }, { status: 400 }); }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!["xlsx", "xls", "csv", "pdf", "docx"].includes(ext)) {
    return NextResponse.json({ error: "XLSX / XLS / CSV / PDF / DOCX 만 지원합니다." }, { status: 400 });
  }

  const companyName = formData.get("companyName");

  // 일위대가 업로드와 동일한 AI 파싱 로직으로 합계만 추출
  let parsed;
  try {
    parsed = await parseQuoteWithOpenAI(file);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const { costSummary } = parsed;
  const summed =
    (costSummary.materialCost ?? 0) +
    (costSummary.laborCost ?? 0) +
    (costSummary.expenseCost ?? 0);
  const totalCost = costSummary.totalCost ?? (summed || null);

  // 수령 견적서 생성
  const receivedBid = await prisma.receivedBid.create({
    data: {
      bidRequestId,
      companyName: companyName ? String(companyName).trim() : file.name.replace(/\.[^.]+$/, ""),
      fileName: file.name,
      fileSize: file.size,
      status: "parsed",
    },
  });

  // 합계를 단일 집계 행으로 저장
  if (totalCost !== null || costSummary.materialCost !== null) {
    await prisma.receivedBidItem.create({
      data: {
        receivedBidId: receivedBid.id,
        rowIndex: 0,
        itemName: "합계",
        materialCost: costSummary.materialCost,
        laborCost: costSummary.laborCost,
        expenseCost: costSummary.expenseCost,
        totalCost,
      },
    });
  }

  await prisma.bidRequest.update({
    where: { id: bidRequestId },
    data: { status: "received" },
  });

  return NextResponse.json({
    receivedBid: { id: receivedBid.id, fileName: file.name },
    costSummary: {
      materialCost: costSummary.materialCost,
      laborCost: costSummary.laborCost,
      expenseCost: costSummary.expenseCost,
      totalCost,
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bidRequestId = Number(id);
  const bids = await prisma.receivedBid.findMany({
    where: { bidRequestId },
    include: { items: { orderBy: { rowIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ bids });
}
