import { NextResponse } from "next/server";
import { matchToMarketPrice } from "@/lib/quote/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 진단용: itemName/spec 으로 매처를 한 번 돌리고 top10 후보의 점수 분해를 반환.
 * Body: { itemName: string, spec?: string | null }
 */
export async function POST(req: Request) {
  let body: { itemName?: unknown; spec?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { itemName: string, spec?: string }" },
      { status: 400 }
    );
  }

  const itemName = typeof body.itemName === "string" ? body.itemName.trim() : "";
  const spec =
    typeof body.spec === "string" && body.spec.trim() !== ""
      ? body.spec.trim()
      : null;

  if (!itemName) {
    return NextResponse.json(
      { error: "itemName is required" },
      { status: 400 }
    );
  }

  const result = await matchToMarketPrice(itemName, spec, {
    includeDebug: true,
  });

  return NextResponse.json({
    query: { itemName, spec },
    chosen: {
      matchedPriceId: result.matchedPriceId,
      matchedItemName: result.matchedItemName,
      matchedSpec: result.matchedSpec,
      matchedConfidence: result.matchedConfidence,
      marketPrice: result.marketPrice,
      marketRegion: result.marketRegion,
      method: result.method,
    },
    topCandidates: result.topCandidates ?? [],
  });
}
