import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseReceivedBidExcel } from "@/lib/quote/parse-received-bid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 결정적 문자열 유사도 (bigram Jaccard)
function norm(s: string) { return s.replace(/\s+/g, "").toLowerCase(); }
function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}
function similarity(a: string, b: string): number {
  const na = norm(a); const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    return 0.7 * (Math.min(na.length, nb.length) / Math.max(na.length, nb.length)) + 0.2;
  }
  const ba = bigrams(na); const bb = bigrams(nb);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0; for (const g of ba) if (bb.has(g)) inter++;
  return inter / (ba.size + bb.size - inter);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bidRequestId = Number(id);
  if (!Number.isInteger(bidRequestId) || bidRequestId <= 0) {
    return NextResponse.json({ error: "잘못된 id" }, { status: 400 });
  }

  // BidRequest + 원본 QuotationItem 로드
  const bidRequest = await prisma.bidRequest.findUnique({
    where: { id: bidRequestId },
    include: {
      quotation: {
        include: { items: { orderBy: { rowIndex: "asc" } } },
      },
    },
  });
  if (!bidRequest) return NextResponse.json({ error: "견적 요청을 찾을 수 없습니다." }, { status: 404 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "multipart/form-data 필요" }, { status: 400 }); }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext)) {
    return NextResponse.json({ error: "XLSX / XLS / CSV 만 지원합니다." }, { status: 400 });
  }

  const companyName = formData.get("companyName");

  let rows;
  try {
    rows = parseReceivedBidExcel(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "추출된 행이 없습니다." }, { status: 400 });
  }

  const origItems = bidRequest.quotation.items;

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

  // 각 항목을 원본 견적 항목과 매칭 후 저장
  const itemData = rows.map((row) => {
    // 원본 항목 중 이름이 가장 유사한 것 찾기
    let bestOrig: (typeof origItems)[number] | null = null;
    let bestScore = 0;
    for (const orig of origItems) {
      const score = similarity(row.itemName, orig.itemName) * 0.8 +
        (row.spec && orig.spec ? similarity(row.spec, orig.spec) * 0.2 : 0);
      if (score > bestScore) { bestScore = score; bestOrig = orig; }
    }

    const origUnitPrice = bestOrig?.unitPrice ?? null;
    const deviationPct =
      row.totalCost !== null && origUnitPrice !== null && origUnitPrice !== 0
        ? ((row.totalCost - origUnitPrice) / origUnitPrice) * 100
        : null;

    return {
      receivedBidId: receivedBid.id,
      rowIndex: row.rowIndex,
      itemName: row.itemName,
      spec: row.spec,
      unit: row.unit,
      materialCost: row.materialCost,
      laborCost: row.laborCost,
      expenseCost: row.expenseCost,
      totalCost: row.totalCost,
      origItemId: bestScore >= 0.3 ? bestOrig?.id ?? null : null,
      matchConfidence: bestScore,
      origDeviationPct: bestScore >= 0.3 ? deviationPct : null,
    };
  });

  await prisma.receivedBidItem.createMany({ data: itemData });

  // BidRequest 상태 갱신
  await prisma.bidRequest.update({
    where: { id: bidRequestId },
    data: { status: "received" },
  });

  return NextResponse.json({ receivedBid: { id: receivedBid.id, fileName: file.name }, itemCount: rows.length });
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
