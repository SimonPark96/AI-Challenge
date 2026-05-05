import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const pid = Number(id);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: `Invalid id: ${id}` }, { status: 400 });
  }

  const row = await prisma.priceSummary.findUnique({ where: { id: pid } });
  if (!row) {
    return NextResponse.json(
      { error: `PriceSummary #${pid} not found` },
      { status: 404 }
    );
  }

  const emb = row.embedding;
  const hasEmbedding = Array.isArray(emb);
  const embeddingDim = hasEmbedding ? (emb as number[]).length : 0;

  return NextResponse.json({
    summary: {
      ...row,
      embedding: undefined,
      hasEmbedding,
      embeddingDim,
    },
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const pid = Number(id);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ error: `Invalid id: ${id}` }, { status: 400 });
  }

  try {
    await prisma.priceSummary.delete({ where: { id: pid } });
    return NextResponse.json({ ok: true, id: pid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("Record to delete")) {
      return NextResponse.json(
        { error: `PriceSummary #${pid} not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
