import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 데이터 리셋. ?type 으로 대상 선택.
 *   - scrape (default): ScrapeRun 전체 삭제 (PriceHistory cascade)
 *   - summary:          PriceSummary 전체 삭제
 *   - all:              둘 다
 *
 * Quotation/Material 본문은 보존.
 * QuotationItem.matchedPriceId / Quotation.priceSummaryId 는 onDelete: SetNull 로 자동 정리.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "scrape";

  if (!["scrape", "summary", "all"].includes(type)) {
    return NextResponse.json(
      { error: `Invalid type: ${type}. Must be scrape | summary | all.` },
      { status: 400 }
    );
  }

  const before = {
    scrapeRuns: await prisma.scrapeRun.count(),
    priceHistory: await prisma.priceHistory.count(),
    priceSummary: await prisma.priceSummary.count(),
  };

  let deletedScrapeRuns = 0;
  let deletedPriceSummary = 0;

  if (type === "scrape" || type === "all") {
    const r = await prisma.scrapeRun.deleteMany();
    deletedScrapeRuns = r.count;
  }
  if (type === "summary" || type === "all") {
    const r = await prisma.priceSummary.deleteMany();
    deletedPriceSummary = r.count;
  }

  const after = {
    scrapeRuns: await prisma.scrapeRun.count(),
    priceHistory: await prisma.priceHistory.count(),
    priceSummary: await prisma.priceSummary.count(),
  };

  return NextResponse.json({
    type,
    deletedScrapeRuns,
    deletedPriceSummary,
    before,
    after,
  });
}
