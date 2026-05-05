import { prisma } from "../prisma";
import {
  buildEmbeddingText,
  cosineSimilarity,
  embedText,
} from "../openai/embed";

export interface MatchCandidateDebug {
  id: number;
  itemName: string;
  spec: string | null;
  price: number | null;
  region: string | null;
  cosine: number;
  deterministic: number;
  combined: number;
  method: "embedding" | "deterministic";
}

export interface MatchResult {
  matchedPriceId: number | null;
  matchedConfidence: number; // 0..1
  marketPrice: number | null;
  marketRegion: string | null;
  matchedItemName: string | null;
  matchedSpec: string | null;
  method: "embedding" | "deterministic" | "none";
  topCandidates?: MatchCandidateDebug[]; // 진단용 (선택)
}

const EMPTY: MatchResult = {
  matchedPriceId: null,
  matchedConfidence: 0,
  marketPrice: null,
  marketRegion: null,
  matchedItemName: null,
  matchedSpec: null,
  method: "none",
};

const MAX_CANDIDATES = 2000;
const PRICE_TIEBREAK_EPSILON = 0.05;
const DETERMINISTIC_WEIGHT = 0.4;

interface CandidateRow {
  id: number;
  itemName: string;
  spec: string | null;
  price: number | null;
  region: string | null;
  embedding: unknown;
}

export interface MatchOptions {
  includeDebug?: boolean;
}

export async function matchToMarketPrice(
  itemName: string,
  spec: string | null,
  options: MatchOptions = {}
): Promise<MatchResult> {
  const cleanName = itemName.trim();
  if (!cleanName) return EMPTY;

  const queryText = buildEmbeddingText(cleanName);
  let queryVec: number[] | null = null;
  try {
    queryVec = await embedText(queryText);
  } catch {
    /* ignore — deterministic 단독으로 진행 */
  }

  const candidatePool = await loadCandidatePool(cleanName, queryVec !== null);
  if (candidatePool.length === 0) return EMPTY;

  type Scored = {
    row: CandidateRow;
    cosine: number;
    deterministic: number;
    combined: number;
    method: "embedding" | "deterministic";
  };

  const scored: Scored[] = candidatePool.map((row) => {
    const det = deterministicScore(cleanName, spec, row.itemName, row.spec);
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
  const top = scored[0];

  // tie 그룹 안에서 price 있는 후보 우선
  const tieGroup = scored.filter(
    (c) => top.combined - c.combined <= PRICE_TIEBREAK_EPSILON
  );
  const priced = tieGroup.find(
    (c) => c.row.price !== null && c.row.price !== undefined
  );
  const chosen = priced ?? top;

  const confidence =
    chosen.method === "embedding" ? chosen.cosine : chosen.deterministic;

  const result: MatchResult = {
    matchedPriceId: chosen.row.id,
    matchedConfidence: Math.max(0, Math.min(1, confidence)),
    marketPrice: chosen.row.price,
    marketRegion: chosen.row.region,
    matchedItemName: chosen.row.itemName,
    matchedSpec: chosen.row.spec,
    method: chosen.method,
  };

  if (options.includeDebug) {
    result.topCandidates = scored.slice(0, 10).map((s) => ({
      id: s.row.id,
      itemName: s.row.itemName,
      spec: s.row.spec,
      price: s.row.price,
      region: s.row.region,
      cosine: s.cosine,
      deterministic: s.deterministic,
      combined: s.combined,
      method: s.method,
    }));
  }

  return result;
}

async function loadCandidatePool(
  cleanName: string,
  embeddingsAvailable: boolean
): Promise<CandidateRow[]> {
  const select = {
    id: true,
    itemName: true,
    spec: true,
    price: true,
    region: true,
    embedding: true,
  };

  if (embeddingsAvailable) {
    return prisma.priceHistory.findMany({
      select,
      orderBy: { fetchedAt: "desc" },
      take: MAX_CANDIDATES,
    });
  }

  let rows = await prisma.priceHistory.findMany({
    where: { itemName: { contains: cleanName } },
    select,
    orderBy: { fetchedAt: "desc" },
    take: 100,
  });
  if (rows.length === 0) {
    const words = cleanName
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 5);
    if (words.length === 0) return [];
    rows = await prisma.priceHistory.findMany({
      where: { OR: words.map((w) => ({ itemName: { contains: w } })) },
      select,
      orderBy: { fetchedAt: "desc" },
      take: 100,
    });
  }
  return rows;
}

/**
 * Deterministic 유사도 (0..1).
 * - 공백 정규화로 "AL몰드"와 "AL 몰드"를 같게 처리
 * - itemName 가중치 0.8, spec 가중치 0.2 (이름이 자재 식별자, spec은 보조)
 * - 부분 매치는 bigram Jaccard 로 평가하여 "AL" 같은 짧은 토큰의 과대평가 방지
 */
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
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.7 * ratio + 0.2; // 부분포함이면 베이스 0.2 + 길이비율 보너스
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
