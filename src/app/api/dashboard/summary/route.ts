import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [byStatus, deviationAgg, latest] = await Promise.all([
    prisma.quotation.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.quotationItem.aggregate({
      _avg: { deviationPct: true },
      _max: { deviationPct: true },
      _min: { deviationPct: true },
      where: { deviationPct: { not: null } },
    }),
    prisma.quotation.findFirst({
      orderBy: { uploadedAt: "desc" },
      select: { uploadedAt: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of byStatus) counts[r.status] = r._count._all;

  const total = byStatus.reduce((acc, r) => acc + r._count._all, 0);
  const inProgress =
    (counts["pending"] ?? 0) + (counts["parsing"] ?? 0);
  const completed = counts["compared"] ?? 0;
  const failed = counts["failed"] ?? 0;

  return NextResponse.json({
    total,
    inProgress,
    completed,
    failed,
    byStatus: counts,
    avgDeviationPct: deviationAgg._avg.deviationPct,
    maxDeviationPct: deviationAgg._max.deviationPct,
    minDeviationPct: deviationAgg._min.deviationPct,
    lastUploadedAt: latest?.uploadedAt ?? null,
  });
}
