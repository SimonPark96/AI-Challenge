import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 외부 단가 자료 일괄 등록(PriceSummary) 검색.
 * - q:    name OR spec 부분일치 (공백으로 토큰 분리되면 모든 토큰을 OR 매치)
 * - name: name 부분일치 (q 와 함께 쓰면 AND)
 * - spec: spec 부분일치
 * - limit: 최대 200 (default 50)
 *
 * 응답에서 embedding 페이로드는 boolean + 차원만 노출.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const nameFilter = searchParams.get("name")?.trim() ?? "";
  const specFilter = searchParams.get("spec")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1),
    200
  );

  const conditions: Prisma.PriceSummaryWhereInput[] = [];

  if (q) {
    const tokens = q.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length > 0) {
      conditions.push({
        AND: tokens.map((t) => ({
          OR: [
            { name: { contains: t } },
            { spec: { contains: t } },
          ],
        })),
      });
    }
  }
  if (nameFilter) conditions.push({ name: { contains: nameFilter } });
  if (specFilter) conditions.push({ spec: { contains: specFilter } });

  const where: Prisma.PriceSummaryWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const rows = await prisma.priceSummary.findMany({
    where,
    orderBy: [{ fetchedAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  const summaries = rows.map((p) => {
    const emb = p.embedding;
    const hasEmbedding = Array.isArray(emb);
    const embeddingDim = hasEmbedding ? (emb as number[]).length : 0;
    return {
      id: p.id,
      name: p.name,
      spec: p.spec,
      unit: p.unit,
      totalCost: p.totalCost,
      materialCost: p.materialCost,
      laborCost: p.laborCost,
      expenseCost: p.expenseCost,
      sourceFile: p.sourceFile,
      sourceVia: p.sourceVia,
      fetchedAt: p.fetchedAt,
      hasEmbedding,
      embeddingDim,
    };
  });

  return NextResponse.json({ count: summaries.length, summaries });
}
