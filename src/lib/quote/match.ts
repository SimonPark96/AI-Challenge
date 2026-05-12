import { prisma } from "../prisma";
import {
  buildEmbeddingText,
  cosineSimilarity,
  embedText,
} from "../openai/embed";
import { specSimilarity, normalizeName } from "./normalize";

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

export const EMPTY_MATCH: MatchResult = {
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

const EMPTY = EMPTY_MATCH;

/**
 * 매칭 제외 품목 — "장비비" 처럼 시장단가 비교 대상이 아닌 표준 합계 항목.
 * 공백/대소문자 무시 후 정확 일치.
 */
export function isMatchExcluded(itemName: string): boolean {
  const normalized = itemName.replace(/\s+/g, "").toLowerCase();
  return normalized === "장비비";
}

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

  // "ST'L PIPE(구조용각형강관)" 형태처럼 괄호 안에 한국어 재질명이 있으면
  // 그 부분을 임베딩 텍스트로 우선 사용. DB 에는 한국어 단독으로 저장되어 있어
  // 혼합 언어 쿼리보다 순수 한국어로 임베딩해야 cosine 이 올바르게 정렬된다.
  const koreanParen = cleanName.match(/\(([가-힣\s·×]+)\)/)?.[1]?.trim();
  const queryText = buildEmbeddingText(koreanParen ?? cleanName);
  let queryVec: number[] | null = null;
  try {
    queryVec = await embedText(queryText);
  } catch {
    /* ignore — deterministic 단독으로 진행 */
  }

  // 한국어 괄호 없으면 약자 토큰(AL, SS 등)으로 후보풀 보강 검색
  const abbrevKeyword =
    koreanParen ??
    (cleanName.match(/\b([A-Za-z]{2,5})\b/g) ?? [])
      .map((t) => t.toUpperCase())
      .find((t) => !ACRONYM_STOPLIST.has(t)) ??
    null;
  const candidatePool = await loadCandidatePool(cleanName, queryVec !== null, abbrevKeyword);
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

  // 신뢰도 = 랭킹에 사용한 combined 점수와 동일 (cos + 0.6×det + acronym 보너스)을
  // 0..1 로 클램프. cosine 단독을 노출하면 deterministic·acronym 가중치로 잘 매칭된
  // 케이스도 신뢰도가 낮게 보이는 비일관성이 있어 통일.
  const confidence = Math.max(0, Math.min(1, chosen.combined));

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
  embeddingsAvailable: boolean,
  koreanKeyword: string | null = null
): Promise<CandidateRow[]> {
  const priceSelect = {
    id: true,
    itemName: true,
    spec: true,
    unit: true,
    price: true,
    region: true,
    embedding: true,
  } as const;

  if (embeddingsAvailable) {
    const [recentPrices, targetedPrices, wages] = await Promise.all([
      prisma.priceHistory.findMany({
        select: priceSelect,
        orderBy: { fetchedAt: "desc" },
        take: MAX_CANDIDATES,
      }),
      // 괄호 한국어 키워드로 직접 검색 — 최신 2000건 바깥에 있어도 확보
      koreanKeyword
        ? prisma.priceHistory.findMany({
            select: priceSelect,
            where: { itemName: { contains: koreanKeyword } },
            orderBy: { fetchedAt: "desc" },
            take: 100,
          })
        : Promise.resolve([] as Awaited<ReturnType<typeof prisma.priceHistory.findMany<{ select: typeof priceSelect }>>>),
      prisma.wageHistory.findMany({
        select: { id: true, jobName: true, cateCd: true, price: true, embedding: true },
        orderBy: { fetchedAt: "desc" },
        take: MAX_CANDIDATES,
      }),
    ]);

    // 중복 제거 — targeted 결과를 앞에 배치해 동점 시 우선
    const seenIds = new Set<number>();
    const allPrices = [...targetedPrices, ...recentPrices].filter((p) => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    const priceRows: CandidateRow[] = allPrices.map((p) => ({
      id: p.id,
      source: "price",
      itemName: p.itemName,
      spec: p.spec,
      price: convertMT(p.price, p.unit),
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
  const keyword = koreanKeyword ?? cleanName;
  const [prices, wages] = await Promise.all([
    findPriceByPrefilter(keyword, 100),
    findWageByPrefilter(keyword, 100),
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
    unit: true,
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
    price: convertMT(p.price, p.unit),
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
 * 영문 약자 보너스에서 제외할 포괄적 단어 목록.
 * 이 단어들은 건설 자재에서 너무 흔해 매칭 신호로 가치가 없음.
 * AL, PVC, SS 같은 재질 약자와 달리 PIPE·TUBE 등은 여러 전혀 다른 품목에
 * 공통으로 등장해 오히려 오매칭을 유발한다.
 */
const ACRONYM_STOPLIST = new Set([
  "PIPE", "TUBE", "BAR", "WIRE", "BOLT", "NUT", "PIN", "ROD",
  "PLATE", "SHEET", "COIL", "BAND", "ANGLE", "BEAM", "RAIL",
  "CABLE", "HOSE", "JOINT", "VALVE", "FLANGE",
]);

/**
 * 영문 짧은 토큰(3~6자) 정확 일치 보너스.
 * - 도메인 약자(AL, PB, SS, MDF, PVC, THK, FRP 등) 가 임베딩 cosine 에는 약하게 잡히지만
 *   실제 의미적 일치 신호로는 매우 강함. itemName 끼리 같은 토큰이 있으면 가산.
 * - 토큰 1개당 ACRONYM_TOKEN_BONUS, 누적 ACRONYM_BONUS_CAP 까지.
 * - 한글/특수문자는 token 분리에서 자동 제외 (영문/숫자 연속만).
 * - ACRONYM_STOPLIST 에 있는 포괄적 단어는 제외 (PIPE, TUBE 등 오매칭 방지).
 */
function shortAsciiTokens(s: string): Set<string> {
  const tokens = s.match(/[A-Za-z][A-Za-z0-9]*/g) ?? [];
  const out = new Set<string>();
  for (const t of tokens) {
    const up = t.toUpperCase();
    // min 2자 유지 — AL·SS·PB 같은 2자 재질 약자 포함, 포괄 단어(PIPE 등)는 stoplist 제외
    if (t.length >= 2 && t.length <= 6 && !ACRONYM_STOPLIST.has(up)) out.add(up);
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
 * - 이름은 부분포함 보너스 + bigram Jaccard
 * - 규격은 normalizeSpec(`*`/`×`/T/㎜ 통일) + numericSimilarity 로 숫자 일치 강하게 평가
 * - itemName 가중치 0.7, spec 가중치 0.3 — 건설 자재는 같은 이름 다른 규격이 흔해
 *   spec 비중을 0.2 → 0.3 으로 상향
 */
function deterministicScore(
  itemA: string,
  specA: string | null,
  itemB: string,
  specB: string | null
): number {
  const nameScore = stringSimilarity(normalizeName(itemA), normalizeName(itemB)) * 0.7;
  const specScore = specA && specB ? specSimilarity(specA, specB) * 0.3 : 0;
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

/** DB 단위가 M/T(메트릭톤)이면 가격을 ÷1,000 하여 kg 기준으로 환산 */
function convertMT(price: number | null, unit: string | null | undefined): number | null {
  if (price == null) return null;
  const u = (unit ?? "").trim().replace(/\s+/g, "").toUpperCase();
  if (u === "M/T" || u === "MT") return price / 1000;
  return price;
}
