import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [
    materials,
    scrapeRuns,
    priceHistory,
    priceSummary,
    quotations,
    bySource,
    embeddedHistory,
    embeddedSummary,
    wageRuns,
    wageHistory,
    wageByCate,
  ] = await Promise.all([
    prisma.material.count(),
    prisma.scrapeRun.count(),
    prisma.priceHistory.count(),
    prisma.priceSummary.count(),
    prisma.quotation.count(),
    prisma.priceHistory.groupBy({
      by: ["source"],
      _count: { _all: true },
    }),
    prisma.priceHistory.count({
      where: { embedding: { not: Prisma.AnyNull } },
    }),
    prisma.priceSummary.count({
      where: { embedding: { not: Prisma.AnyNull } },
    }),
    prisma.wageRun.count(),
    prisma.wageHistory.count(),
    prisma.wageHistory.groupBy({
      by: ["cateCd"],
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    materials,
    scrapeRuns,
    priceHistory,
    priceSummary,
    quotations,
    embeddedHistory,
    embeddedSummary,
    wageRuns,
    wageHistory,
    bySource: bySource.map((s) => ({
      source: s.source,
      count: s._count._all,
    })),
    wageByCate: wageByCate.map((w) => ({
      cateCd: w.cateCd,
      count: w._count._all,
    })),
  });
}
