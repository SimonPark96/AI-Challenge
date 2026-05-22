import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cateCd = searchParams.get("cateCd")?.trim() || undefined;
  const jobName = searchParams.get("jobName")?.trim() || "";
  const limit = Math.min(
    Number(searchParams.get("limit") ?? 10_000) || 10_000,
    10_000
  );

  // jobName 은 in-memory 에서 공백/대소문자 무시 매칭. cateCd 는 정확 일치라 DB WHERE 사용.
  const rows = await prisma.wageHistory.findMany({
    where: cateCd ? { cateCd } : undefined,
    orderBy: [{ cateCd: "asc" }, { jobName: "asc" }],
    take: limit,
    select: {
      id: true,
      cateCd: true,
      jobName: true,
      price: true,
      unit: true,
      basis: true,
      description: true,
      fetchedAt: true,
    },
  });

  const filtered = jobName
    ? (() => {
        const q = normalize(jobName);
        return rows.filter((r) => normalize(r.jobName).includes(q));
      })()
    : rows;

  const recentRuns = await prisma.wageRun.findMany({
    orderBy: { id: "desc" },
    take: 5,
    select: {
      id: true,
      cateCd: true,
      sourceUrl: true,
      fetchedAt: true,
      _count: { select: { wages: true } },
    },
  });

  return NextResponse.json({
    wages: filtered,
    count: filtered.length,
    recentRuns,
  });
}
