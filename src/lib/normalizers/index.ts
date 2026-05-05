import type { ScrapedTable, ScrapeSource } from "../scrapers/types";

export interface NormalizedRow {
  itemName: string;
  spec?: string;
  unit?: string;
  region?: string;
  price?: number;
  currency: string;
  extras?: Record<string, string>;
}

// 헤더 매칭용 후보 토큰. 부분문자열 매칭이라 "호칭경"도 "호칭"으로 잡힘.
const META = {
  itemName: ["품명", "자재명", "품 명", "name"],
  spec: ["규격", "호칭", "spec"],
  unit: ["단위", "unit"],
};
const PRICE_HEADERS = ["단가", "가격", "price", "현재가", "당월가"];

// 가격/지역으로 오인되면 안 되는 컬럼들 — region row 도, extras 도 만들지 않고 버린다.
// (KPRC 의 "페이지" 가 페이지번호인데 숫자라 가격으로 파싱되던 케이스)
const SKIP_HEADERS = ["페이지", "page"];

function isSkipHeader(h: string): boolean {
  if (!h) return false;
  const lower = h.toLowerCase();
  return SKIP_HEADERS.some((s) => lower.includes(s.toLowerCase()));
}

/**
 * 사이트별 raw 테이블을 공통 NormalizedRow[] 로 변환.
 *
 * 동작:
 * 1. 헤더에서 품명/규격/단위/단가 컬럼 인덱스를 추정
 * 2. 단가 컬럼이 있으면: 행당 1개 row 생성, 그 외 컬럼은 extras 로
 * 3. 단가 컬럼이 없으면: 메타 외 컬럼들을 region:price 쌍으로 보고
 *    숫자로 파싱되는 셀마다 row 1개씩 생성 (서울/부산/... 다지역 케이스)
 * 4. 품명을 못 찾으면 raw 그대로 extras 에 담은 fallback row
 */
export function normalize(table: ScrapedTable): NormalizedRow[] {
  const headers = table.headers;

  const findIdx = (candidates: string[]): number => {
    for (const c of candidates) {
      const i = headers.findIndex((h) => h && h.includes(c));
      if (i >= 0) return i;
    }
    return -1;
  };

  const idxName = findIdx(META.itemName);
  const idxSpec = findIdx(META.spec);
  const idxUnit = findIdx(META.unit);
  const idxPrice = findIdx(PRICE_HEADERS);

  if (idxName < 0) {
    return table.rows.map((row) => ({
      itemName: "(unparsed)",
      currency: "KRW",
      extras: row,
    }));
  }

  const skipIdxs = new Set<number>();
  headers.forEach((h, i) => {
    if (isSkipHeader(h)) skipIdxs.add(i);
  });
  // skipIdxs 를 usedIdxs 에 합치면 region row · extras 양쪽에서 자동으로 제외됨.
  const usedIdxs = new Set(
    [idxName, idxSpec, idxUnit, idxPrice, ...skipIdxs].filter((i) => i >= 0)
  );
  const out: NormalizedRow[] = [];

  for (const row of table.rows) {
    const cells = headers.map((h) => row[h] ?? "");
    const itemName = cells[idxName];
    if (!itemName) continue;
    const spec = idxSpec >= 0 ? cells[idxSpec] : undefined;
    const unit = idxUnit >= 0 ? cells[idxUnit] : undefined;

    if (idxPrice >= 0) {
      const price = parsePrice(cells[idxPrice]);
      const extras: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (!usedIdxs.has(i) && cells[i]) extras[h] = cells[i];
      });
      out.push({
        itemName,
        spec: spec || undefined,
        unit: unit || undefined,
        price,
        currency: "KRW",
        extras: Object.keys(extras).length > 0 ? extras : undefined,
      });
    } else {
      let pushedAny = false;
      const leftovers: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (usedIdxs.has(i)) return;
        const cell = cells[i];
        if (!cell) return;
        const price = parsePrice(cell);
        if (price !== undefined) {
          out.push({
            itemName,
            spec: spec || undefined,
            unit: unit || undefined,
            region: h,
            price,
            currency: "KRW",
          });
          pushedAny = true;
        } else {
          leftovers[h] = cell;
        }
      });
      if (!pushedAny) {
        out.push({
          itemName,
          spec: spec || undefined,
          unit: unit || undefined,
          currency: "KRW",
          extras:
            Object.keys(leftovers).length > 0 ? leftovers : undefined,
        });
      }
    }
  }

  return out;
}

function parsePrice(s: string): number | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/[,\s원₩￦]/g, "").trim();
  if (!cleaned) return undefined;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * CMPI 전용 normalizer.
 *
 * CMPI 의 table.tbtype03 은 다단 헤더이고 leaf 헤더가 의미 없는 표식(①/②)이라
 * 공통 normalize 로는 처리 불가. 구조는:
 *   headerRows[0] = ["품 명", "규 격", "단 위", "가 격", "페이지"]   (상단 group)
 *   headerRows[1] = [지역1, 지역2, ...]                              ("가 격" 하위)
 *   headerRows[2] = ["①", "②", "②", ...]                             (의미 없음)
 *   row cells     = [품명, 규격, 단위, 지역1가, 지역2가, ..., 페이지]
 *
 * 메타 3개(품명/규격/단위) + 마지막 1개(페이지) 를 제외한 가운데 컬럼을
 * 지역별 가격으로 분해해 row 당 region:price 쌍을 N 개 생성한다.
 */
function normalizeCmpi(table: ScrapedTable): NormalizedRow[] {
  const headerRows = table.headerRows;
  const top = headerRows[0] ?? [];
  const regionRow = headerRows[1] ?? [];
  const looksLikeCmpi =
    top.length >= 4 &&
    top[0]?.replace(/\s/g, "").includes("품명") &&
    top.some((h) => h?.replace(/\s/g, "").includes("가격"));
  if (!looksLikeCmpi) {
    return normalize(table);
  }

  const out: NormalizedRow[] = [];
  for (const row of table.rows) {
    // row 키는 col0/col1/... 형식. 숫자 접미사 순으로 정렬해 안전하게 배열화.
    const cells = Object.entries(row)
      .map(([k, v]) => [parseInt(k.replace(/^col/, ""), 10), v] as const)
      .filter(([i]) => Number.isFinite(i))
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v);

    if (cells.length < 5) continue;
    const itemName = cells[0];
    if (!itemName) continue;
    const spec = cells[1] || undefined;
    const unit = cells[2] || undefined;

    // 마지막 컬럼은 페이지 — 제외. 가운데 모두 가격 후보.
    const priceCells = cells.slice(3, cells.length - 1);
    priceCells.forEach((cell, i) => {
      const price = parsePrice(cell);
      if (price === undefined) return;
      const region = regionRow[i]?.replace(/\s+/g, "") || `col${i + 3}`;
      out.push({
        itemName,
        spec,
        unit,
        region,
        price,
        currency: "KRW",
      });
    });
  }
  return out;
}

// 사이트별 dispatch (cmpi 만 다단 헤더 — 전용 처리)
export function normalizeForSource(
  source: ScrapeSource,
  table: ScrapedTable
): NormalizedRow[] {
  if (source === "cmpi") return normalizeCmpi(table);
  return normalize(table);
}
