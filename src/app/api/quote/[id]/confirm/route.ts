import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 검토 결과를 "확정" 상태로 전환.
 * - POST   : status -> "confirmed"  (기존 status 가 compared/confirmed/failed/... 무관하게 강제 확정)
 * - DELETE : status -> "compared"   (확정 취소)
 *
 * Quotation.status 는 String 필드라 별도 마이그레이션 없이 새 값을 사용.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const qid = Number(id);
  if (!Number.isFinite(qid) || qid <= 0) {
    return NextResponse.json({ error: `Invalid id: ${id}` }, { status: 400 });
  }

  const existing = await prisma.quotation.findUnique({
    where: { id: qid },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: `Quotation #${qid} not found` },
      { status: 404 }
    );
  }

  const updated = await prisma.quotation.update({
    where: { id: qid },
    data: { status: "confirmed" },
    select: { id: true, status: true },
  });
  return NextResponse.json({ ok: true, ...updated });
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

  const existing = await prisma.quotation.findUnique({
    where: { id: qid },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: `Quotation #${qid} not found` },
      { status: 404 }
    );
  }
  // 확정만 되돌림 — 확정 안 된 경우엔 그냥 no-op
  if (existing.status !== "confirmed") {
    return NextResponse.json({ ok: true, id: qid, status: existing.status });
  }
  const updated = await prisma.quotation.update({
    where: { id: qid },
    data: { status: "compared" },
    select: { id: true, status: true },
  });
  return NextResponse.json({ ok: true, ...updated });
}
