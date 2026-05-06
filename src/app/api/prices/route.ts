import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Number(searchParams.get("limit") ?? 10_000) || 10_000,
    10_000
  );
  const source = searchParams.get("source") ?? undefined;
  const itemName = searchParams.get("itemName")?.trim() ?? "";
  const spec = searchParams.get("spec")?.trim() ?? "";
  const region = searchParams.get("region") ?? undefined;
  const scrapeRunIdRaw = searchParams.get("runId");
  const scrapeRunId = scrapeRunIdRaw ? Number(scrapeRunIdRaw) : undefined;

  // 텍스트 검색은 in-memory 정규화(공백 무시·대소문자 무시) 비교로 처리.
  // 정확 일치/관계 필드(source/region/runId) 만 DB WHERE 로 필터.
  const rows = await prisma.priceHistory.findMany({
    where: {
      source: source ?? undefined,
      region: region ?? undefined,
      scrapeRunId:
        scrapeRunId !== undefined && Number.isFinite(scrapeRunId)
          ? scrapeRunId
          : undefined,
    },
    orderBy: [{ fetchedAt: "desc" }, { id: "asc" }],
    take: limit,
  });

  const itemNameQ = itemName ? normalize(itemName) : "";
  const specQ = spec ? normalize(spec) : "";
  const filtered =
    itemNameQ || specQ
      ? rows.filter((r) => {
          if (itemNameQ && !normalize(r.itemName).includes(itemNameQ)) {
            return false;
          }
          if (specQ) {
            const s = r.spec ? normalize(r.spec) : "";
            if (!s.includes(specQ)) return false;
          }
          return true;
        })
      : rows;

  // 임베딩 페이로드는 무거우므로 응답에서는 boolean + 차원만 노출
  const prices = filtered.map((p) => {
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
