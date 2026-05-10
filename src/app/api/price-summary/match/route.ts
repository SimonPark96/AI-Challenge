import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildEmbeddingTextWithSpec,
  cosineSimilarity,
  embedText,
} from "@/lib/openai/embed";
import { specSimilarity, stringSimilarity } from "@/lib/quote/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CANDIDATES = 2000;

// 가중평균 (0..1 의미). cos/det 모두 0..1 이므로 가중치도 합이 1 이도록.
const COSINE_WEIGHT = 0.5;
const DETERMINISTIC_WEIGHT = 0.5;

interface Body {
  name?: string;
  spec?: string;
  // 필터 — 모두 옵션. 적용 시 풀 prefilter 후 스코어링.
  businessDivision?: string;
  dateFrom?: string; // YYYY-MM-DD; 행의 lastContractDate 가 이 값 이상이어야 통과
  dateTo?: string; //   YYYY-MM-DD; 행의 firstContractDate 가 이 값 이하여야 통과
}

function parseDateOrNull(s: string | undefined | null): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * 공사명/규격으로 PriceSummary 자동 매칭.
 * 입력: { name, spec?, businessDivision?, dateFrom?, dateTo? }
 * 출력: { candidates: top5 } — 각 후보에 PriceSummary 필드 + confidence/method/스코어
 *
 * 신뢰도(confidence) = 0.5 × cosine + 0.5 × deterministic (둘 다 0..1).
 * - cosine: text-embedding-3-small 의 의미적 유사도 (name+spec 임베딩 기준)
 * - deterministic: name 0.6 + spec 0.4 가중치, spec 은 숫자 차원이 있으면
 *                  numeric similarity 가 70% 비중 + 문자열 유사도 30%
 *
 * 정렬·표시 모두 confidence 단일 키로 처리 → 카드 순서 = 신뢰도 내림차순.
 *
 * 기간 필터는 [dateFrom, dateTo] 와 행의 [firstContractDate, lastContractDate] 가
 * 겹치는 경우만 통과시키는 overlap 시맨틱. 행의 계약일자가 null 이면 필터 활성화 시
 * 자동 제외 (사용자가 필터를 비우면 다시 보임).
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

  const businessDivision = body.businessDivision?.trim() || null;
  const dateFrom = parseDateOrNull(body.dateFrom);
  const dateTo = parseDateOrNull(body.dateTo);

  const queryText = buildEmbeddingTextWithSpec(name, spec);

  let queryVec: number[] | null = null;
  try {
    queryVec = await embedText(queryText);
  } catch {
    /* deterministic 단독으로 진행 */
  }

  const pool = await prisma.priceSummary.findMany({
    where: {
      ...(businessDivision ? { businessDivision } : {}),
      ...(dateFrom ? { lastContractDate: { gte: dateFrom } } : {}),
      ...(dateTo ? { firstContractDate: { lte: dateTo } } : {}),
    },
    take: MAX_CANDIDATES,
    orderBy: { fetchedAt: "desc" },
  });
  if (pool.length === 0) {
    return NextResponse.json({
      candidates: [],
      reason:
        businessDivision || dateFrom || dateTo
          ? "필터 조건에 맞는 PriceSummary 가 없습니다."
          : "PriceSummary DB 비어있음",
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
        combined: COSINE_WEIGHT * cos + DETERMINISTIC_WEIGHT * det,
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

  // 정렬 키 = 신뢰도 (confidence). 카드 표시도 동일.
  scored.sort((a, b) => b.combined - a.combined);
  const candidates = scored.slice(0, 5).map((s) => {
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
      projectName: s.row.projectName,
      businessDivision: s.row.businessDivision,
      firstContractDate: s.row.firstContractDate,
      lastContractDate: s.row.lastContractDate,
      confidence: Math.max(0, Math.min(1, s.combined)),
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
  const nameScore = stringSimilarity(itemA, itemB) * 0.6;
  const specScore = specA && specB ? specSimilarity(specA, specB) * 0.4 : 0;
  return nameScore + specScore;
}
