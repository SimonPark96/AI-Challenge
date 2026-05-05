import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_GROUPS: Record<string, string[]> = {
  // compared 는 분석은 끝났지만 사용자가 결과 확정을 누르지 않은 상태 → 진행 중으로 분류.
  inProgress: ["pending", "parsing", "matching", "compared"],
  completed: ["confirmed"],
  failed: ["failed"],
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200);
  const statusFilter = searchParams.get("status"); // 'all' | 'inProgress' | 'completed' | 'failed' | exact status

  let where: { status?: { in: string[] } | string } | undefined;
  if (statusFilter && statusFilter !== "all") {
    if (STATUS_GROUPS[statusFilter]) {
      where = { status: { in: STATUS_GROUPS[statusFilter] } };
    } else {
      where = { status: statusFilter };
    }
  }

  const quotes = await prisma.quotation.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    take: limit,
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      uploadedAt: true,
      status: true,
      errorMsg: true,
      rawResponse: true,
      _count: { select: { items: true } },
      items: {
        orderBy: { rowIndex: "asc" },
        take: 1,
        select: {
          itemName: true,
          spec: true,
          unit: true,
          unitPrice: true,
          marketPrice: true,
          deviationPct: true,
          matchedConfidence: true,
        },
      },
    },
  });

  const items = quotes.map((q) => {
    const meta =
      typeof q.rawResponse === "object" &&
      q.rawResponse !== null &&
      !Array.isArray(q.rawResponse)
        ? (q.rawResponse as Record<string, unknown>)
        : null;
    const projectName =
      typeof meta?.projectName === "string" ? meta.projectName : null;
    const partnerName =
      typeof meta?.partnerName === "string" ? meta.partnerName : null;
    const item = q.items[0] ?? null;
    return {
      id: q.id,
      fileName: q.fileName,
      uploadedAt: q.uploadedAt,
      status: q.status,
      errorMsg: q.errorMsg,
      itemCount: q._count.items,
      projectName,
      partnerName,
      summary: item,
    };
  });

  return NextResponse.json({ count: items.length, quotes: items });
}
