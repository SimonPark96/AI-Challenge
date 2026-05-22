import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const qid = Number(id);
  if (!Number.isFinite(qid) || qid <= 0) {
    return NextResponse.json({ error: `Invalid id: ${id}` }, { status: 400 });
  }

  const quote = await prisma.quotation.findUnique({
    where: { id: qid },
    include: {
      items: {
        orderBy: { rowIndex: "asc" },
        include: { matchedPrice: true },
      },
    },
  });

  if (!quote) {
    return NextResponse.json(
      { error: `Quotation #${qid} not found` },
      { status: 404 }
    );
  }

  return NextResponse.json({ quote });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const qid = Number(id);
  if (!Number.isFinite(qid) || qid <= 0)
    return NextResponse.json({ error: `Invalid id: ${id}` }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if ("priceSummaryId" in body) {
    const v = body.priceSummaryId;
    updateData.priceSummaryId = typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  if ("competitorBids" in body) {
    const current = await prisma.quotation.findUnique({
      where: { id: qid },
      select: { rawResponse: true },
    });
    const raw =
      typeof current?.rawResponse === "object" &&
      current.rawResponse !== null &&
      !Array.isArray(current.rawResponse)
        ? { ...(current.rawResponse as Record<string, unknown>) }
        : {};
    raw.competitorBids = body.competitorBids;
    updateData.rawResponse = raw;
  }

  if (Object.keys(updateData).length === 0)
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const updated = await prisma.quotation.update({
    where: { id: qid },
    data: updateData,
    select: { id: true, priceSummaryId: true },
  });
  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const qid = Number(id);
  if (!Number.isFinite(qid) || qid <= 0) {
    return NextResponse.json({ error: `Invalid id: ${id}` }, { status: 400 });
  }

  try {
    await prisma.quotation.delete({ where: { id: qid } });
    return NextResponse.json({ ok: true, id: qid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("Record to delete")) {
      return NextResponse.json(
        { error: `Quotation #${qid} not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
