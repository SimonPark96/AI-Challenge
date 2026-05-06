import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cosineSimilarity, embedText } from "@/lib/openai/embed";

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

  const queryText = spec ? `${name} ${spec}` : name;

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

/**
 * 규격 유사도. 두 규격 모두 숫자가 포함되면 numeric similarity 가 주로 작동.
 * - "3mx6m" vs "3mx6.27m" 처럼 숫자 차원이 있는 경우, 단순 bigram 보다 훨씬 정확.
 * - 둘 다 비숫자 규격(예: "철근 D16")이면 string similarity 만 사용.
 */
function specSimilarity(a: string, b: string): number {
  const numsA = extractNumbers(a);
  const numsB = extractNumbers(b);
  const stringSim = stringSimilarity(a, b);
  if (numsA.length > 0 && numsB.length > 0) {
    const numSim = numericSimilarity(numsA, numsB);
    return 0.3 * stringSim + 0.7 * numSim;
  }
  return stringSim;
}

function extractNumbers(s: string): number[] {
  const m = s.match(/\d+(?:\.\d+)?/g);
  return m ? m.map(Number) : [];
}

/**
 * 숫자 배열 유사도 (0..1). 짝지어 상대 거리 비교 + count mismatch 패널티.
 * - 같은 자리수의 숫자 짝: |a-b|/max(|a|,|b|) → 1에서 차감
 * - 자리수 다르면 (예: [3,6] vs [3,6,2.5]) 짧은 쪽 길이만 평가 후 길이 비율 패널티
 */
function numericSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let total = 0;
  for (let i = 0; i < len; i++) {
    const va = a[i];
    const vb = b[i];
    if (va === 0 && vb === 0) {
      total += 1;
    } else {
      const denom = Math.max(Math.abs(va), Math.abs(vb));
      const diff = denom === 0 ? 0 : Math.abs(va - vb) / denom;
      total += Math.max(0, 1 - diff);
    }
  }
  const countPenalty = len / Math.max(a.length, b.length);
  return (total / len) * countPenalty;
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
