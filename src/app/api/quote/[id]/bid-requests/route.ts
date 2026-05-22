import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quotationId = Number(id);
  if (!Number.isInteger(quotationId) || quotationId <= 0) {
    return NextResponse.json({ error: "잘못된 id" }, { status: 400 });
  }

  const bidRequests = await prisma.bidRequest.findMany({
    where: { quotationId },
    include: {
      workType: { select: { id: true, name: true, parentId: true } },
      receivedBids: {
        include: {
          items: { orderBy: { rowIndex: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 원본 QuotationItem 도 함께 반환 (비교 표에 사용)
  const quotationItems = await prisma.quotationItem.findMany({
    where: { quotationId },
    orderBy: { rowIndex: "asc" },
    select: { id: true, itemName: true, spec: true, unit: true, unitPrice: true, quantity: true },
  });

  return NextResponse.json({ bidRequests, quotationItems });
}
