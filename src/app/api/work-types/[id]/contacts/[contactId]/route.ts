import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { contactId } = await params;
  const numId = Number(contactId);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: "잘못된 contactId" }, { status: 400 });
  }
  const body = await req.json();
  const { companyName, email, contactName, phone } = body;
  if (!companyName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "업체명·이메일은 필수입니다" }, { status: 400 });
  }
  try {
    const contact = await prisma.workTypeContact.update({
      where: { id: numId },
      data: {
        companyName: companyName.trim(),
        email: email.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
      },
    });
    return NextResponse.json({ contact });
  } catch {
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

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
