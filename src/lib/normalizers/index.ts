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

  const usedIdxs = new Set(
    [idxName, idxSpec, idxUnit, idxPrice].filter((i) => i >= 0)
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

// 사이트별 dispatch (현재는 모두 공통 로직, 추후 사이트별 quirks 추가 시 분기)
export function normalizeForSource(
  _source: ScrapeSource,
  table: ScrapedTable
): NormalizedRow[] {
  return normalize(table);
}
