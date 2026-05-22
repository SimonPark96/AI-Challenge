import { prisma } from "../prisma";
import {
  buildEmbeddingTextWithSpec,
  cosineSimilarity,
  embedTexts,
} from "../openai/embed";
import { specSimilarity } from "./normalize";

const MAX_CANDIDATES = 2000;
const DETERMINISTIC_WEIGHT = 0.6;
const ACRONYM_TOKEN_BONUS = 0.1;
const ACRONYM_BONUS_CAP = 0.2;

export interface ConfidentialQuoteMatchResult {
  confId: number;
  confName: string;
  confSpec: string | null;
  confUnit: string | null;
  confTotalCost: number | null;
  confMaterialCost: number | null;
  confLaborCost: number | null;
  confExpenseCost: number | null;
  confidence: number;
}

/** 견적 전체(공종명/프로젝트명)를 사내 DB 단가와 1:1 매칭하여 합계 단가 비교용 조(組)를 반환 */
export async function matchQuoteToConfidential(
  name: string,
  spec?: string | null
): Promise<ConfidentialQuoteMatchResult | null> {
  const cleanName = name.trim();
  if (!cleanName) return null;

  const pool = await prisma.confidentialPrice.findMany({
    select: {
      id: true,
      name: true,
      spec: true,
      unit: true,
      totalCost: true,
      materialCost: true,
      laborCost: true,
      expenseCost: true,
      embedding: true,
    },
    orderBy: { fetchedAt: "desc" },
    take: MAX_CANDIDATES,
  });

  if (pool.length === 0) return null;

  const queryText = buildEmbeddingTextWithSpec(cleanName, spec);
  let queryVec: number[] | null = null;
  try {
    const vecs = await embedTexts([queryText]);
    queryVec = vecs[0];
  } catch {
    // deterministic fallback
  }

  const scored = pool.map((row) => {
    const det = deterministicScore(cleanName, spec ?? null, row.name, row.spec);
    const acro = acronymBonus(cleanName, row.name);
    const combined =
      queryVec && Array.isArray(row.embedding)
        ? cosineSimilarity(queryVec, row.embedding as number[]) + DETERMINISTIC_WEIGHT * det + acro
        : det + acro;
    return { row, combined };
  });

  scored.sort((a, b) => b.combined - a.combined);
  const best = scored[0];
  if (!best) return null;

  return {
    confId: best.row.id,
    confName: best.row.name,
    confSpec: best.row.spec,
    confUnit: best.row.unit,
    confTotalCost: best.row.totalCost,
    confMaterialCost: best.row.materialCost,
    confLaborCost: best.row.laborCost,
    confExpenseCost: best.row.expenseCost,
    confidence: Math.max(0, Math.min(1, best.combined)),
  };
}

export interface ConfidentialMatchResult {
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unitPrice: number | null;
  confId: number | null;
  confName: string | null;
  confSpec: string | null;
  confUnit: string | null;
  confTotalCost: number | null;
  confidence: number;
  deviationPct: number | null;
}

interface CandidateRow {
  id: number;
  name: string;
  spec: string | null;
  unit: string | null;
  totalCost: number | null;
  embedding: unknown;
}

export async function matchItemsToConfidential(
  items: Array<{ rowIndex: number; itemName: string; spec?: string | null; unitPrice?: number | null }>
): Promise<ConfidentialMatchResult[]> {
  if (items.length === 0) return [];

  // 후보 풀 1회 로드
  const pool = await prisma.confidentialPrice.findMany({
    select: { id: true, name: true, spec: true, unit: true, totalCost: true, embedding: true },
    orderBy: { fetchedAt: "desc" },
    take: MAX_CANDIDATES,
  });

  if (pool.length === 0) {
    return items.map((it) => ({
      rowIndex: it.rowIndex,
      itemName: it.itemName,
      spec: it.spec ?? null,
      unitPrice: it.unitPrice ?? null,
      confId: null,
      confName: null,
      confSpec: null,
      confUnit: null,
      confTotalCost: null,
      confidence: 0,
      deviationPct: null,
    }));
  }

  // 모든 아이템 임베딩을 단일 배치 API 호출로 처리 (N번 → 1번).
  // ConfidentialPrice 인덱스가 "name + spec" 형식이므로 query 도 동일하게 합쳐 임베딩.
  const queryTexts = items.map((it) =>
    buildEmbeddingTextWithSpec(it.itemName, it.spec)
  );
  let queryVecs: (number[] | null)[] = new Array(items.length).fill(null);
  try {
    const vecs = await embedTexts(queryTexts);
    queryVecs = vecs;
  } catch {
    /* 임베딩 실패 시 deterministic 스코어만 사용 */
  }

  return items.map((it, idx) => {
    const cleanName = it.itemName.trim();
    if (!cleanName) {
      return {
        rowIndex: it.rowIndex,
        itemName: it.itemName,
        spec: it.spec ?? null,
        unitPrice: it.unitPrice ?? null,
        confId: null,
        confName: null,
        confSpec: null,
        confUnit: null,
        confTotalCost: null,
        confidence: 0,
        deviationPct: null,
      };
    }

    const queryVec = queryVecs[idx];

    type Scored = { row: CandidateRow; combined: number; cosine: number; deterministic: number };
    const scored: Scored[] = pool.map((row) => {
      const det = deterministicScore(cleanName, it.spec ?? null, row.name, row.spec);
      const acro = acronymBonus(cleanName, row.name);
      if (queryVec && Array.isArray(row.embedding)) {
        const cos = cosineSimilarity(queryVec, row.embedding as number[]);
        return { row, cosine: cos, deterministic: det, combined: cos + DETERMINISTIC_WEIGHT * det + acro };
      }
      return { row, cosine: 0, deterministic: det, combined: det + acro };
    });

    scored.sort((a, b) => b.combined - a.combined);
    const best = scored[0];

    if (!best) {
      return {
        rowIndex: it.rowIndex,
        itemName: it.itemName,
        spec: it.spec ?? null,
        unitPrice: it.unitPrice ?? null,
        confId: null,
        confName: null,
        confSpec: null,
        confUnit: null,
        confTotalCost: null,
        confidence: 0,
        deviationPct: null,
      };
    }

    // 신뢰도 = 랭킹에 사용한 combined 점수와 동일 (cos + 0.6×det + acronym 보너스)을
    // 0..1 로 클램프. cosine 단독을 노출하면 deterministic·acronym 가중치로 잘 매칭된
    // 케이스도 신뢰도가 낮게 보이는 비일관성이 있어 통일.
    const confidence = Math.max(0, Math.min(1, best.combined));
    const partnerPrice = it.unitPrice ?? null;
    const confPrice = best.row.totalCost;
    const deviationPct =
      partnerPrice !== null && confPrice !== null && confPrice !== 0
        ? ((partnerPrice - confPrice) / confPrice) * 100
        : null;

    return {
      rowIndex: it.rowIndex,
      itemName: it.itemName,
      spec: it.spec ?? null,
      unitPrice: partnerPrice,
      confId: best.row.id,
      confName: best.row.name,
      confSpec: best.row.spec,
      confUnit: best.row.unit,
      confTotalCost: confPrice,
      confidence,
      deviationPct,
    };
  });
}

function shortAsciiTokens(s: string): Set<string> {
  const tokens = s.match(/[A-Za-z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (const t of tokens) {
    if (t.length >= 2 && t.length <= 6) out.add(t.toUpperCase());
  }
  return out;
}

function acronymBonus(a: string, b: string): number {
  const A = shortAsciiTokens(a);
  if (A.size === 0) return 0;
  const B = shortAsciiTokens(b);
  if (B.size === 0) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return Math.min(n * ACRONYM_TOKEN_BONUS, ACRONYM_BONUS_CAP);
}

function deterministicScore(a: string, sa: string | null, b: string, sb: string | null): number {
  return stringSimilarity(a, b) * 0.7 + (sa && sb ? specSimilarity(sa, sb) * 0.3 : 0);
}

function stringSimilarity(a: string, b: string): number {
  const na = a.replace(/\s+/g, "").toLowerCase();
  const nb = b.replace(/\s+/g, "").toLowerCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    return 0.7 * (Math.min(na.length, nb.length) / Math.max(na.length, nb.length)) + 0.2;
  }
  return bigramJaccard(na, nb);
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
