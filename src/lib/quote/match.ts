import { prisma } from "../prisma";
import {
  buildEmbeddingText,
  cosineSimilarity,
  embedText,
} from "../openai/embed";

const WAGE_CATE_LABELS: Record<string, string> = {
  "701111": "공사부문",
  "701115": "기타직종",
};

export type MatchSource = "price" | "wage";

export interface MatchCandidateDebug {
  id: number;
  source: MatchSource;
  itemName: string;
  spec: string | null;
  price: number | null;
  region: string | null;
  cosine: number;
  deterministic: number;
  acronym: number; // 영문 짧은 토큰 일치 보너스
  combined: number;
  method: "embedding" | "deterministic";
}

export interface MatchResult {
  source: MatchSource | "none";
  matchedPriceId: number | null;
  matchedWageId: number | null;
  matchedConfidence: number; // 0..1
  marketPrice: number | null;
  marketRegion: string | null;
  matchedItemName: string | null;
  matchedSpec: string | null;
  method: "embedding" | "deterministic" | "none";
  topCandidates?: MatchCandidateDebug[]; // 진단용 (선택)
}

const EMPTY: MatchResult = {
  source: "none",
  matchedPriceId: null,
  matchedWageId: null,
  matchedConfidence: 0,
  marketPrice: null,
  marketRegion: null,
  matchedItemName: null,
  matchedSpec: null,
  method: "none",
};

const MAX_CANDIDATES = 2000;
const PRICE_TIEBREAK_EPSILON = 0.05;
// 짧은 영문 약자(AL, PB, SS, THK 등) 도메인에서 deterministic 의 비중을 키워야
// 멀티링구얼 임베딩이 영문↔한글 동의어를 잘 못 잡는 케이스를 보완할 수 있음.
const DETERMINISTIC_WEIGHT = 0.6; // ↑ from 0.4
const ACRONYM_TOKEN_BONUS = 0.1; // 토큰 1개 일치당 가점
const ACRONYM_BONUS_CAP = 0.2; // 누적 상한 (과도한 부스트 방지)

interface CandidateRow {
  id: number;
  source: MatchSource;
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
    acronym: number;
    combined: number;
    method: "embedding" | "deterministic";
  };

  const scored: Scored[] = candidatePool.map((row) => {
    const det = deterministicScore(cleanName, spec, row.itemName, row.spec);
    const acro = acronymBonus(cleanName, row.itemName);
    if (queryVec && Array.isArray(row.embedding)) {
      const cos = cosineSimilarity(queryVec, row.embedding as number[]);
      return {
        row,
        cosine: cos,
        deterministic: det,
        acronym: acro,
        combined: cos + DETERMINISTIC_WEIGHT * det + acro,
        method: "embedding",
      };
    }
    return {
      row,
      cosine: 0,
      deterministic: det,
      acronym: acro,
      combined: det + acro,
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
    source: chosen.row.source,
    matchedPriceId: chosen.row.source === "price" ? chosen.row.id : null,
    matchedWageId: chosen.row.source === "wage" ? chosen.row.id : null,
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
      source: s.row.source,
      itemName: s.row.itemName,
      spec: s.row.spec,
      price: s.row.price,
      region: s.row.region,
      cosine: s.cosine,
      deterministic: s.deterministic,
      acronym: s.acronym,
      combined: s.combined,
      method: s.method,
    }));
  }

  return result;
}

/**
 * 후보 풀: 자재 단가(PriceHistory) + 노임 단가(WageHistory) 모두 포함.
 * 두 도메인을 같은 CandidateRow 모양으로 어댑트해 같은 점수 공식을 적용한다.
 * 임베딩 이용 가능 시: 양쪽 풀 합쳐 최대 MAX_CANDIDATES 까지.
 * 임베딩 미사용(deterministic only): 이름 부분일치 prefilter 양쪽 적용.
 */
async function loadCandidatePool(
  cleanName: string,
  embeddingsAvailable: boolean
): Promise<CandidateRow[]> {
  if (embeddingsAvailable) {
    const [prices, wages] = await Promise.all([
      prisma.priceHistory.findMany({
        select: {
          id: true,
          itemName: true,
          spec: true,
          price: true,
          region: true,
          embedding: true,
        },
        orderBy: { fetchedAt: "desc" },
        take: MAX_CANDIDATES,
      }),
      prisma.wageHistory.findMany({
        select: {
          id: true,
          jobName: true,
          cateCd: true,
          price: true,
          embedding: true,
        },
        orderBy: { fetchedAt: "desc" },
        take: MAX_CANDIDATES,
      }),
    ]);
    const priceRows: CandidateRow[] = prices.map((p) => ({
      id: p.id,
      source: "price",
      itemName: p.itemName,
      spec: p.spec,
      price: p.price,
      region: p.region,
      embedding: p.embedding,
    }));
    const wageRows: CandidateRow[] = wages.map((w) => ({
      id: w.id,
      source: "wage",
      itemName: w.jobName,
      spec: null,
      price: w.price,
      region: WAGE_CATE_LABELS[w.cateCd] ?? w.cateCd,
      embedding: w.embedding,
    }));
    return [...priceRows, ...wageRows];
  }

  // deterministic 단독 — 이름 부분일치 prefilter
  const [prices, wages] = await Promise.all([
    findPriceByPrefilter(cleanName, 100),
    findWageByPrefilter(cleanName, 100),
  ]);
  return [...prices, ...wages];
}

async function findPriceByPrefilter(
  cleanName: string,
  take: number
): Promise<CandidateRow[]> {
  const select = {
    id: true,
    itemName: true,
    spec: true,
    price: true,
    region: true,
    embedding: true,
  };
  let rows = await prisma.priceHistory.findMany({
    where: { itemName: { contains: cleanName } },
    select,
    orderBy: { fetchedAt: "desc" },
    take,
  });
  if (rows.length === 0) {
    const words = cleanName
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 5);
    if (words.length > 0) {
      rows = await prisma.priceHistory.findMany({
        where: { OR: words.map((w) => ({ itemName: { contains: w } })) },
        select,
        orderBy: { fetchedAt: "desc" },
        take,
      });
    }
  }
  return rows.map((p) => ({
    id: p.id,
    source: "price" as const,
    itemName: p.itemName,
    spec: p.spec,
    price: p.price,
    region: p.region,
    embedding: p.embedding,
  }));
}

async function findWageByPrefilter(
  cleanName: string,
  take: number
): Promise<CandidateRow[]> {
  const select = {
    id: true,
    jobName: true,
    cateCd: true,
    price: true,
    embedding: true,
  };
  let rows = await prisma.wageHistory.findMany({
    where: { jobName: { contains: cleanName } },
    select,
    orderBy: { fetchedAt: "desc" },
    take,
  });
  if (rows.length === 0) {
    const words = cleanName
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 5);
    if (words.length > 0) {
      rows = await prisma.wageHistory.findMany({
        where: { OR: words.map((w) => ({ jobName: { contains: w } })) },
        select,
        orderBy: { fetchedAt: "desc" },
        take,
      });
    }
  }
  return rows.map((w) => ({
    id: w.id,
    source: "wage" as const,
    itemName: w.jobName,
    spec: null,
    price: w.price,
    region: WAGE_CATE_LABELS[w.cateCd] ?? w.cateCd,
    embedding: w.embedding,
  }));
}

/**
 * 영문 짧은 토큰(2~6자) 정확 일치 보너스.
 * - 도메인 약자(AL, PB, SS, MDF, PVC, THK, FRP 등) 가 임베딩 cosine 에는 약하게 잡히지만
 *   실제 의미적 일치 신호로는 매우 강함. itemName 끼리 같은 토큰이 있으면 가산.
 * - 토큰 1개당 ACRONYM_TOKEN_BONUS, 누적 ACRONYM_BONUS_CAP 까지.
 * - 한글/특수문자는 token 분리에서 자동 제외 (영문/숫자 연속만).
 */
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
  if (n === 0) return 0;
  return Math.min(n * ACRONYM_TOKEN_BONUS, ACRONYM_BONUS_CAP);
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
