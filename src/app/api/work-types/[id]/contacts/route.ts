import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workTypeId = Number(id);
  if (!Number.isInteger(workTypeId) || workTypeId <= 0) {
    return NextResponse.json({ error: "잘못된 id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const companyName = String(body.companyName ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!companyName || !email) {
    return NextResponse.json({ error: "업체명과 이메일이 필요합니다." }, { status: 400 });
  }

  const contact = await prisma.workTypeContact.create({
    data: {
      workTypeId,
      companyName,
      email,
      contactName: body.contactName ? String(body.contactName).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
    },
  });
  return NextResponse.json({ contact });
}
