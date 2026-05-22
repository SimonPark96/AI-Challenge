import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requests = await prisma.bidRequest.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      sentAt: true,
      companyName: true,
      workType: { select: { id: true, name: true } },
      quotation: { select: { id: true, fileName: true } },
      receivedBids: {
        select: {
          id: true,
          companyName: true,
          status: true,
          fileName: true,
          items: {
            select: { materialCost: true, laborCost: true, expenseCost: true, totalCost: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const quotationId = body.quotationId ? Number(body.quotationId) : null;
  const workTypeId = body.workTypeId ? Number(body.workTypeId) : null;
  const title = String(body.title ?? "").trim() || null;
  const description = String(body.description ?? "").trim() || null;
  const companyName = String(body.companyName ?? "").trim() || null;

  const request = await prisma.bidRequest.create({
    data: {
      quotationId: quotationId ?? undefined,
      workTypeId,
      companyName,
      title,
      description,
      status: "sent",
      sentAt: new Date(),
    },
    include: {
      workType: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ request });
}
