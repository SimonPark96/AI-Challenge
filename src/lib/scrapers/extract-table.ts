import type { Locator } from "playwright";
import type { ExtractedTable } from "./types";

/**
 * <table>의 thead/tbody 를 일반화된 ExtractedTable 로 변환.
 * - thead 의 모든 행을 headerRows 로 보존 (계층/병합 헤더 대응)
 * - thead 가 없으면 tbody 첫 행이 th 만으로 구성된 경우 헤더로 승격
 * - 셀 수가 헤더 수와 같으면 { 헤더: 값 } 매핑, 다르면 col0/col1/... 폴백
 */
export async function extractTable(table: Locator): Promise<ExtractedTable> {
  const theadRows = table.locator("thead tr");
  const theadCount = await theadRows.count();
  const headerRows: string[][] = [];
  for (let i = 0; i < theadCount; i++) {
    const cells = await theadRows.nth(i).locator("th, td").allInnerTexts();
    const cleaned = cells.map((c) => c.replace(/\s+/g, " ").trim());
    if (cleaned.length > 0) headerRows.push(cleaned);
  }

  let skipFirstBodyRow = false;
  if (headerRows.length === 0) {
    const firstBody = table.locator("tbody tr").first();
    if ((await firstBody.count()) > 0) {
      const thCount = await firstBody.locator("th").count();
      const tdCount = await firstBody.locator("td").count();
      if (thCount > 0 && tdCount === 0) {
        const cells = await firstBody.locator("th, td").allInnerTexts();
        headerRows.push(cells.map((c) => c.replace(/\s+/g, " ").trim()));
        skipFirstBodyRow = true;
      }
    }
  }

  const headers =
    headerRows.length > 0 ? headerRows[headerRows.length - 1] : [];

  const bodyRowsLoc = table.locator("tbody tr");
  const rowCount = await bodyRowsLoc.count();
  const rows: Record<string, string>[] = [];
  const startIdx = skipFirstBodyRow ? 1 : 0;
  for (let i = startIdx; i < rowCount; i++) {
    const row = bodyRowsLoc.nth(i);
    const cells = await row.locator("td, th").allInnerTexts();
    const cleaned = cells.map((c) => c.replace(/\s+/g, " ").trim());
    if (cleaned.every((c) => c === "")) continue;
    const obj: Record<string, string> = {};
    if (headers.length > 0 && headers.length === cleaned.length) {
      headers.forEach((h, j) => {
        obj[h || `col${j}`] = cleaned[j];
      });
    } else {
      cleaned.forEach((c, j) => {
        obj[`col${j}`] = c;
      });
    }
    rows.push(obj);
  }
  return { headers, headerRows, rows };
}
