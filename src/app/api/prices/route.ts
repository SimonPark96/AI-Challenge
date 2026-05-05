import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 100) || 100, 500);
  const source = searchParams.get("source") ?? undefined;
  const itemName = searchParams.get("itemName") ?? undefined;
  const region = searchParams.get("region") ?? undefined;
  const scrapeRunIdRaw = searchParams.get("runId");
  const scrapeRunId = scrapeRunIdRaw ? Number(scrapeRunIdRaw) : undefined;

  const rows = await prisma.priceHistory.findMany({
    where: {
      source: source ?? undefined,
      itemName: itemName ? { contains: itemName } : undefined,
      region: region ?? undefined,
      scrapeRunId:
        scrapeRunId !== undefined && Number.isFinite(scrapeRunId)
          ? scrapeRunId
          : undefined,
    },
    orderBy: [{ fetchedAt: "desc" }, { id: "asc" }],
    take: limit,
  });

  // 임베딩 페이로드는 무거우므로 응답에서는 boolean + 차원만 노출
  const prices = rows.map((p) => {
    const emb = p.embedding;
    const hasEmbedding = Array.isArray(emb);
    const embeddingDim = hasEmbedding ? (emb as number[]).length : 0;
    return {
      ...p,
      embedding: undefined,
      hasEmbedding,
      embeddingDim,
    };
  });

  return NextResponse.json({ count: prices.length, prices });
}
