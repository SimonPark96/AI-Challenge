import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 대공종 + 세부공종 기본 데이터
const DEFAULT_TREE = [
  {
    name: "건축",
    description: "건축 구조 및 마감 공사",
    children: ["골조공사", "마감공사", "가설공사", "방수공사", "창호공사"],
  },
  {
    name: "전기",
    description: "전기 설비 및 배선 공사",
    children: ["수변전설비", "간선공사", "조명설비", "동력설비", "접지설비"],
  },
  {
    name: "설비",
    description: "기계 설비 및 배관 공사",
    children: ["위생설비", "냉난방설비", "환기설비", "급배수설비"],
  },
  {
    name: "토목",
    description: "토목 및 기초 공사",
    children: ["토공사", "기초공사", "포장공사", "배수공사"],
  },
  {
    name: "소방",
    description: "소방 설비 공사",
    children: ["소화설비", "경보설비", "피난설비"],
  },
  {
    name: "통신",
    description: "통신 및 네트워크 공사",
    children: ["전화설비", "방송설비", "네트워크설비"],
  },
];

export async function GET() {
  const workTypes = await prisma.workType.findMany({
    where: { parentId: null }, // 대공종만
    include: {
      children: {
        include: { contacts: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ workTypes });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // 초기 기본 데이터 시드
  if (body.seed === true) {
    const existing = await prisma.workType.findMany({
      where: { parentId: null },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((w) => w.name));

    for (const entry of DEFAULT_TREE) {
      if (existingNames.has(entry.name)) continue;
      const parent = await prisma.workType.create({
        data: { name: entry.name, description: entry.description },
      });
      await prisma.workType.createMany({
        data: entry.children.map((c) => ({ name: c, parentId: parent.id })),
      });
    }

    const workTypes = await prisma.workType.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: { contacts: { orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ seeded: true, workTypes });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "공종명이 필요합니다." },
      { status: 400 }
    );
  }

  const parentId = body.parentId ? Number(body.parentId) : null;
  const workType = await prisma.workType.create({
    data: { name, description: body.description ?? null, parentId },
    include: { contacts: true, children: true },
  });
  return NextResponse.json({ workType });
}
