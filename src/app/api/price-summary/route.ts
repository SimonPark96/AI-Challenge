import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 일괄 등록(PriceSummary) 검색.
 * - q:    name OR spec 부분일치 (공백 분리 시 모든 토큰 포함, 공백/대소문자 무시)
 * - name: name 부분일치 (q 와 함께 쓰면 AND)
 * - spec: spec 부분일치
 * - limit: 최대 10000 (default 10000 — 사실상 전체)
 *
 * 응답에서 embedding 페이로드는 boolean + 차원만 노출.
 */
function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const nameFilter = searchParams.get("name")?.trim() ?? "";
  const specFilter = searchParams.get("spec")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 10_000) || 10_000, 1),
    10_000
  );

  // 텍스트 매칭은 모두 in-memory 정규화 비교로 처리.
  const rows = await prisma.priceSummary.findMany({
    orderBy: [{ fetchedAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  const qTokens = q
    ? q.split(/\s+/).filter((t) => t.length > 0).map(normalize)
    : [];
  const nameNorm = nameFilter ? normalize(nameFilter) : "";
  const specNorm = specFilter ? normalize(specFilter) : "";

  const filtered = rows.filter((r) => {
    const nameN = normalize(r.name);
    const specN = r.spec ? normalize(r.spec) : "";

    // q: 모든 토큰이 name 또는 spec 에 포함 (정규화 후)
    if (qTokens.length > 0) {
      for (const t of qTokens) {
        if (!nameN.includes(t) && !specN.includes(t)) return false;
      }
    }
    if (nameNorm && !nameN.includes(nameNorm)) return false;
    if (specNorm && !specN.includes(specNorm)) return false;
    return true;
  });

  const summaries = filtered.map((p) => {
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
      projectName: p.projectName,
      businessDivision: p.businessDivision,
      firstContractDate: p.firstContractDate,
      lastContractDate: p.lastContractDate,
      fetchedAt: p.fetchedAt,
      hasEmbedding,
      embeddingDim,
    };
  });

  return NextResponse.json({ count: summaries.length, summaries });
}
