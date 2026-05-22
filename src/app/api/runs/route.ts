import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200);
  const source = searchParams.get("source") ?? undefined;

  const runs = await prisma.scrapeRun.findMany({
    where: source ? { source } : undefined,
    orderBy: { fetchedAt: "desc" },
    take: limit,
    select: {
      id: true,
      source: true,
      keyword: true,
      sourceUrl: true,
      fetchedAt: true,
      createdAt: true,
      _count: { select: { prices: true } },
    },
  });

  return NextResponse.json({ count: runs.length, runs });
}
