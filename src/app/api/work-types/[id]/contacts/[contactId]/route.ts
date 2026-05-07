import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { contactId } = await params;
  const numId = Number(contactId);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: "잘못된 contactId" }, { status: 400 });
  }
  try {
    await prisma.workTypeContact.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
