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
  // 결과 확정(confirmed) 만 "완료". 그 외 분석/매칭/비교까지 끝난 compared 도 "진행 중".
  const inProgress =
    (counts["pending"] ?? 0) +
    (counts["parsing"] ?? 0) +
    (counts["matching"] ?? 0) +
    (counts["compared"] ?? 0);
  const completed = counts["confirmed"] ?? 0;
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
