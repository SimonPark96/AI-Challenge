import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cosineSimilarity, embedText } from "@/lib/openai/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CANDIDATES = 2000;
const DETERMINISTIC_WEIGHT = 0.4;

interface Body {
  name?: string;
  spec?: string;
}

/**
 * 공사명/규격으로 PriceSummary 자동 매칭.
 * 입력: { name, spec? }
 * 출력: { matched: { ...PriceSummary } | null, confidence, method, candidates: top3 }
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const spec = (body.spec ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "name 은 필수입니다." },
      { status: 400 }
    );
  }

  const queryText = spec ? `${name} ${spec}` : name;

  let queryVec: number[] | null = null;
  try {
    queryVec = await embedText(queryText);
  } catch {
    /* deterministic 단독으로 진행 */
  }

  const pool = await prisma.priceSummary.findMany({
    take: MAX_CANDIDATES,
    orderBy: { fetchedAt: "desc" },
  });
  if (pool.length === 0) {
    return NextResponse.json({
      candidates: [],
      reason: "PriceSummary DB 비어있음",
    });
  }

  type Scored = {
    row: (typeof pool)[number];
    cosine: number;
    deterministic: number;
    combined: number;
    method: "embedding" | "deterministic";
  };

  const scored: Scored[] = pool.map((row) => {
    const det = deterministicScore(name, spec || null, row.name, row.spec);
    if (queryVec && Array.isArray(row.embedding)) {
      const cos = cosineSimilarity(queryVec, row.embedding as number[]);
      return {
        row,
        cosine: cos,
        deterministic: det,
        combined: cos + DETERMINISTIC_WEIGHT * det,
        method: "embedding",
      };
    }
    return {
      row,
      cosine: 0,
      deterministic: det,
      combined: det,
      method: "deterministic",
    };
  });

  scored.sort((a, b) => b.combined - a.combined);
  const candidates = scored.slice(0, 3).map((s) => {
    const conf = s.method === "embedding" ? s.cosine : s.deterministic;
    return {
      id: s.row.id,
      name: s.row.name,
      spec: s.row.spec,
      unit: s.row.unit,
      totalCost: s.row.totalCost,
      materialCost: s.row.materialCost,
      laborCost: s.row.laborCost,
      expenseCost: s.row.expenseCost,
      sourceFile: s.row.sourceFile,
      sourceVia: s.row.sourceVia,
      confidence: Math.max(0, Math.min(1, conf)),
      method: s.method,
      cosine: s.cosine,
      deterministic: s.deterministic,
      combined: s.combined,
    };
  });

  return NextResponse.json({ candidates });
}

function deterministicScore(
  itemA: string,
  specA: string | null,
  itemB: string,
  specB: string | null
): number {
  const nameScore = stringSimilarity(itemA, itemB) * 0.8;
  const specScore =
    specA && specB ? stringSimilarity(specA, specB) * 0.2 : 0;
  return nameScore + specScore;
}

function stringSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio =
      Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.7 * ratio + 0.2;
  }
  return bigramJaccard(na, nb);
}

function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function bigramJaccard(a: string, b: string): number {
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  const union = ba.size + bb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}
