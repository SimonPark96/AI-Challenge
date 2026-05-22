import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 사이드바 하단 'DB 현황' 카운터.
 *   - internal:  내부 실적 (Material — placeholder)
 *   - external:  외부 사이트 스크래핑 (PriceHistory)
 *   - summaries: 외부 단가 자료 일괄 등록 (PriceSummary)
 */
export async function GET() {
  const [internal, external, summaries] = await Promise.all([
    prisma.material.count(),
    prisma.priceHistory.count(),
    prisma.priceSummary.count(),
  ]);
  return NextResponse.json({ internal, external, summaries });
}
