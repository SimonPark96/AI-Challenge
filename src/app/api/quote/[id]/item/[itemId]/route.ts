import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  itemName?: string;
  spec?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  marketPrice?: number | null;
  marketRegion?: string | null;
  matchedConfidence?: number | null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v === null) return null;
  return null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await context.params;
  const qid = Number(id);
  const iid = Number(itemId);
  if (!Number.isFinite(qid) || qid <= 0)
    return NextResponse.json({ error: `Invalid quote id: ${id}` }, { status: 400 });
  if (!Number.isFinite(iid) || iid <= 0)
    return NextResponse.json({ error: `Invalid item id: ${itemId}` }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const existing = await prisma.quotationItem.findFirst({
    where: { id: iid, quotationId: qid },
  });
  if (!existing) {
    return NextResponse.json(
      { error: `Item #${iid} (quote #${qid}) not found` },
      { status: 404 }
    );
  }

  // 부분 업데이트 — undefined 면 기존값 유지, null 명시면 null 로 set.
  const next = {
    itemName:
      body.itemName !== undefined ? String(body.itemName) : existing.itemName,
    spec:
      body.spec !== undefined
        ? body.spec === null
          ? null
          : String(body.spec)
        : existing.spec,
    unit:
      body.unit !== undefined
        ? body.unit === null
          ? null
          : String(body.unit)
        : existing.unit,
    quantity:
      body.quantity !== undefined ? num(body.quantity) : existing.quantity,
    unitPrice:
      body.unitPrice !== undefined ? num(body.unitPrice) : existing.unitPrice,
    marketPrice:
      body.marketPrice !== undefined
        ? num(body.marketPrice)
        : existing.marketPrice,
    marketRegion:
      body.marketRegion !== undefined
        ? body.marketRegion === null
          ? null
          : String(body.marketRegion)
        : existing.marketRegion,
    matchedConfidence:
      body.matchedConfidence !== undefined
        ? num(body.matchedConfidence)
        : existing.matchedConfidence,
  };

  // 파생값 — 항상 재계산
  const totalPrice =
    next.unitPrice != null && next.quantity != null
      ? next.unitPrice * next.quantity
      : null;
  const deviationPct =
    next.unitPrice != null && next.marketPrice != null && next.marketPrice !== 0
      ? ((next.unitPrice - next.marketPrice) / next.marketPrice) * 100
      : null;

  const updated = await prisma.quotationItem.update({
    where: { id: iid },
    data: {
      itemName: next.itemName,
      spec: next.spec,
      unit: next.unit,
      quantity: next.quantity,
      unitPrice: next.unitPrice,
      marketPrice: next.marketPrice,
      marketRegion: next.marketRegion,
      matchedConfidence: next.matchedConfidence,
      totalPrice,
      deviationPct,
    },
    include: { matchedPrice: true },
  });

  return NextResponse.json({ ok: true, item: updated });
}
