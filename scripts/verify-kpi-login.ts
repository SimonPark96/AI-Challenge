import { chromium, type Locator } from "playwright";
import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOGIN_URL = "https://www.kpi.or.kr/www/member/login.asp";
const SEARCH_KEYWORD = "폴리카보네이트 복층판";

interface ExtractedTable {
  headers: string[];
  headerRows: string[][];
  rows: Record<string, string>[];
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const envPath = join(projectRoot, ".env.local");
  if (!existsSync(envPath)) {
    console.error(`[ERROR] ${envPath} 가 없습니다.`);
    process.exit(1);
  }
  loadEnvConfig(projectRoot);

  const ID = process.env.KPI_ID;
  const PW = process.env.KPI_PW;
  if (!ID || !PW) {
    console.error("[ERROR] .env.local 에 KPI_ID, KPI_PW 가 필요합니다.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[1/9] 로그인 페이지 진입: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

    console.log("[2/9] 아이디 입력 (#user_id)");
    await page.locator("#user_id").fill(ID);

    console.log("[3/9] 비밀번호 입력 (#user_pw)");
    await page.locator("#user_pw").fill(PW);

    console.log("[4/9] 로그인 버튼 클릭 (#sendLogin)");
    await page.locator("#sendLogin").click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    console.log(`  → 로그인 후 URL: ${page.url()}`);

    console.log(
      "[5/9] 모달 닫기 (.modal_container > .join_footer > .btn.btn_close)"
    );
    const closeBtn = page
      .locator(".modal_container > .join_footer > .btn.btn_close")
      .first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      console.log("  → 모달 닫음");
    } else {
      console.log("  → 모달이 보이지 않아 스킵");
    }

    console.log(`[6/9] 검색어 입력 "${SEARCH_KEYWORD}" (input#q)`);
    const searchInput = page.locator(
      "div.ser-ban > form > div.top_search > input#q"
    );
    await searchInput.waitFor({ state: "visible", timeout: 10_000 });
    await searchInput.fill(SEARCH_KEYWORD);

    console.log("[7/9] 검색 버튼 클릭 (div.ser-ban > form > button.search)");
    const searchBtn = page.locator("div.ser-ban > form > button.search");
    await Promise.all([
      page.waitForURL(/\/search\//, { timeout: 20_000 }),
      searchBtn.click(),
    ]);
    await page.waitForLoadState("domcontentloaded");
    console.log(`  → 검색 결과 URL: ${page.url()}`);

    console.log("[8/9] 물가정보 결과 테이블의 첫 아이템 클릭 → 상세 페이지");
    const titleDiv = page
      .locator("div.tsr-area > div.tsr-area-L div.ser-pg-ttl")
      .filter({ hasText: "물가정보" })
      .first();
    await titleDiv.waitFor({ state: "attached", timeout: 15_000 });
    const resultTable = titleDiv.locator(
      "xpath=./following-sibling::table[1]"
    );
    await resultTable.waitFor({ state: "attached", timeout: 10_000 });

    const firstRow = resultTable.locator("tbody tr").first();
    await firstRow.waitFor({ state: "visible", timeout: 10_000 });
    const linkInRow = firstRow.locator("td a").first();
    const hasLink = (await linkInRow.count()) > 0;
    const target = hasLink ? linkInRow : firstRow.locator("td").first();
    const targetText =
      (await target.textContent())?.replace(/\s+/g, " ").trim().slice(0, 100) ??
      "";
    console.log(`  → 클릭 대상 (link=${hasLink}): "${targetText}"`);

    const popupPromise = context
      .waitForEvent("page", { timeout: 5_000 })
      .catch(() => null);
    await target.click();
    const popup = await popupPromise;
    const detailPage = popup ?? page;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded");
      console.log(`  → 상세 페이지 (새 탭): ${detailPage.url()}`);
    } else {
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});
      console.log(`  → 상세 페이지 (같은 탭): ${detailPage.url()}`);
    }

    console.log("[9/9] div.detl-wro.price-tb > table 추출 + JSON 저장");
    const priceTable = detailPage
      .locator(
        "div.detl-wro.price-tb > table, div.detl-wro .price-tb > table, div.detl-wro table.price-tb, div.detl-wro > table"
      )
      .first();
    await priceTable.waitFor({ state: "visible", timeout: 20_000 });

    const result = await extractTable(priceTable);
    console.log(
      `  → 행 수: ${result.rows.length}, headerRows(${result.headerRows.length}):`
    );
    result.headerRows.forEach((row, i) =>
      console.log(`     [${i}] ${JSON.stringify(row)}`)
    );
    console.log(`  → leaf headers: ${JSON.stringify(result.headers)}`);

    mkdirSync("data", { recursive: true });
    const safeKeyword = SEARCH_KEYWORD.replace(/\s+/g, "_");
    const outPath = join(projectRoot, "data", `kpi-${safeKeyword}.json`);
    const payload = {
      source: "한국물가정보 (kpi.or.kr)",
      keyword: SEARCH_KEYWORD,
      sourceUrl: detailPage.url(),
      fetchedAt: new Date().toISOString(),
      headers: result.headers,
      headerRows: result.headerRows,
      rows: result.rows,
    };
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
    console.log(`  → 저장 완료: ${outPath}`);

    console.log("\n브라우저는 30초 후 자동 종료. (Ctrl+C 로 즉시 종료)");
    await detailPage.waitForTimeout(30_000);
  } finally {
    await browser.close();
  }
}

async function extractTable(table: Locator): Promise<ExtractedTable> {
  // 1) thead 안의 모든 행을 캡처 (계층/병합 헤더 보존)
  const theadRows = table.locator("thead tr");
  const theadCount = await theadRows.count();
  const headerRows: string[][] = [];
  for (let i = 0; i < theadCount; i++) {
    const cells = await theadRows.nth(i).locator("th, td").allInnerTexts();
    const cleaned = cells.map((c) => c.replace(/\s+/g, " ").trim());
    if (cleaned.length > 0) headerRows.push(cleaned);
  }

  // 2) thead 가 없으면 tbody 첫 행이 th 만으로 구성된 경우 헤더로 인정
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

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});
