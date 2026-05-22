import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 데이터 리셋. ?type 으로 대상 선택.
 *   - scrape  (default): ScrapeRun 전체 삭제 (PriceHistory cascade)
 *   - summary:           PriceSummary 전체 삭제
 *   - wage:              WageRun 전체 삭제 (WageHistory cascade)
 *   - all:               셋 다
 *
 * Quotation/Material 본문은 보존.
 * QuotationItem.matchedPriceId / Quotation.priceSummaryId 는 onDelete: SetNull 로 자동 정리.
 */
const VALID = ["scrape", "summary", "wage", "all"] as const;
type ResetType = (typeof VALID)[number];

function isResetType(s: string): s is ResetType {
  return (VALID as readonly string[]).includes(s);
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "scrape";

  if (!isResetType(type)) {
    return NextResponse.json(
      { error: `Invalid type: ${type}. Must be ${VALID.join(" | ")}.` },
      { status: 400 }
    );
  }

  const before = {
    scrapeRuns: await prisma.scrapeRun.count(),
    priceHistory: await prisma.priceHistory.count(),
    priceSummary: await prisma.priceSummary.count(),
    wageRuns: await prisma.wageRun.count(),
    wageHistory: await prisma.wageHistory.count(),
  };

  let deletedScrapeRuns = 0;
  let deletedPriceSummary = 0;
  let deletedWageRuns = 0;

  if (type === "scrape" || type === "all") {
    const r = await prisma.scrapeRun.deleteMany();
    deletedScrapeRuns = r.count;
  }
  if (type === "summary" || type === "all") {
    const r = await prisma.priceSummary.deleteMany();
    deletedPriceSummary = r.count;
  }
  if (type === "wage" || type === "all") {
    const r = await prisma.wageRun.deleteMany();
    deletedWageRuns = r.count;
  }

  const after = {
    scrapeRuns: await prisma.scrapeRun.count(),
    priceHistory: await prisma.priceHistory.count(),
    priceSummary: await prisma.priceSummary.count(),
    wageRuns: await prisma.wageRun.count(),
    wageHistory: await prisma.wageHistory.count(),
  };

  return NextResponse.json({
    type,
    deletedScrapeRuns,
    deletedPriceSummary,
    deletedWageRuns,
    before,
    after,
  });
}
