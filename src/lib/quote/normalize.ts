/**
 * 매칭용 텍스트 정규화 유틸리티.
 *
 * 건설 자재 단가는 사이트마다 표기가 제각각이라 글자 그대로 비교하면 같은 자재도
 * bigram 이 어긋나 점수가 깎인다. 이 모듈이 매칭 직전에 query/index 양측을 동일한
 * 정규형으로 변환해 deterministic 유사도(이름·규격·숫자) 계산을 안정화한다.
 *
 * 임베딩 텍스트 자체는 변경하지 않음 — 기존 저장된 벡터와 호환 유지.
 */

/**
 * 규격 문자열을 정규형으로 변환.
 *
 * - 곱셈 기호 통일: ×, ✕, ⨯, * → x
 * - 두께 표기 통일: "9T", "T9", "THK9" → "9"
 * - 단위 제거: ㎜, mm, ㎏, kg, /m 등
 * - 다중값 구분자(콤마/세미콜론/、) → 공백
 * - 공백 정리, 소문자화
 *
 * 예) "100*100*9T" → "100x100x9"
 *     "150×100㎜, 3.2㎜, 12㎏/m" → "150x100 3.2 12"
 */
export function normalizeSpec(
  spec: string | null | undefined
): string {
  if (!spec) return "";
  return spec
    .replace(/[×✕⨯Χ\*]/g, "x")
    .replace(/(\d+(?:\.\d+)?)\s*T\b/gi, "$1")
    .replace(/\bTHK\s*(\d+(?:\.\d+)?)/gi, "$1")
    .replace(/㎜|㎟/g, "")
    .replace(/\bmm\b/gi, "")
    .replace(/㎏\s*\/?\s*m?/g, "")
    .replace(/\bkg\s*\/?\s*m?\b/gi, "")
    .replace(/[,，、;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * 자재명 정규화 — 영어 약자를 캐노니컬 형태로.
 * 너무 공격적으로 바꾸면 의미가 손실되므로 자주 충돌하는 약자만 처리.
 */
export function normalizeName(
  name: string | null | undefined
): string {
  if (!name) return "";
  return name
    .replace(/\bST['']?L\b/gi, "STEEL")
    .replace(/\bSTL\b/gi, "STEEL")
    .replace(/\s+/g, " ")
    .trim();
}

/** 문자열에서 숫자(소수 포함)를 추출. "150x100x3.2" → [150, 100, 3.2] */
export function extractNumbers(s: string): number[] {
  const m = s.match(/\d+(?:\.\d+)?/g);
  return m ? m.map(Number) : [];
}

/**
 * 숫자 배열 유사도 (0..1).
 *
 * 두 단계:
 * 1) 그리디 best-match — query 각 숫자에 대해 index 에서 가장 가까운 값을 짝지어
 *    평균. 위치 기반보다 다중값 spec ("125x125, 150x100") 처리에 강하다.
 * 2) 길이 패널티 — query 숫자가 1개인데 index 에 5개 있는 식으로 정보량이 다르면
 *    우연 매칭(예: "THK2" 의 2 가 "100x100x2" 의 2 에 우연히 일치) 가능성이 높음.
 *    min/max 로 곱해 보정.
 *
 * 한 번 매칭된 index 숫자는 재사용 안 함.
 */
export function numericSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const used = new Set<number>();
  let total = 0;
  for (const va of a) {
    let best = 0;
    let bestIdx = -1;
    for (let i = 0; i < b.length; i++) {
      if (used.has(i)) continue;
      const vb = b[i];
      const denom = Math.max(Math.abs(va), Math.abs(vb));
      // 2× 가중치로 큰 차이에 더 엄격하게 패널티: 100 vs 150 → 0.333 (기존 0.667)
      const sim = denom === 0 ? 1 : Math.max(0, 1 - 2 * Math.abs(va - vb) / denom);
      if (sim > best) {
        best = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) used.add(bestIdx);
    total += best;
  }
  const avg = total / a.length;
  const lenRatio =
    Math.min(a.length, b.length) / Math.max(a.length, b.length);
  return avg * lenRatio;
}

/**
 * 규격 유사도 (0..1). 양측을 normalizeSpec 으로 정리한 뒤,
 * - 양쪽 모두 숫자가 있으면: 0.3 × 문자열 + 0.7 × numeric
 * - 한쪽만 숫자가 있거나 둘 다 없으면: 문자열 유사도만
 */
export function specSimilarity(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  if (!a || !b) return 0;
  const na = normalizeSpec(a);
  const nb = normalizeSpec(b);
  if (!na || !nb) return 0;
  const numsA = extractNumbers(na);
  const numsB = extractNumbers(nb);
  const stringSim = stringSimilarity(na, nb);
  if (numsA.length > 0 && numsB.length > 0) {
    const numSim = numericSimilarity(numsA, numsB);
    return 0.3 * stringSim + 0.7 * numSim;
  }
  return stringSim;
}

/** 일반 문자열 유사도 (정규화 + 부분포함 보너스 + bigram Jaccard). */
export function stringSimilarity(a: string, b: string): number {
  const na = a.replace(/\s+/g, "").toLowerCase();
  const nb = b.replace(/\s+/g, "").toLowerCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio =
      Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.7 * ratio + 0.2;
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
