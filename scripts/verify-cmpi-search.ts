import { chromium, type Locator } from "playwright";
import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HOME_URL = "https://cmpi.or.kr/frame/";
const SEARCH_KEYWORD = "고장력철근";

interface ExtractedTable {
  headers: string[]; // leaf 행 (row dict 의 key 로 쓰임)
  headerRows: string[][]; // thead 의 모든 행 (병합/계층 헤더 보존용)
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

  const ID = process.env.CMPI_ID;
  const PW = process.env.CMPI_PW;
  if (!ID || !PW) {
    console.error("[ERROR] .env.local 에 CMPI_ID, CMPI_PW 가 필요합니다.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await browser.newContext();
  let page = await context.newPage();

  try {
    console.log(`[1/5] 진입: ${HOME_URL}`);
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

    console.log(
      "[2/5] 로그인 (input[name=user_login_id/pw] + 형제 td 안의 img 클릭)"
    );
    const idInput = page.locator('input[name="user_login_id"]').first();
    await idInput.waitFor({ state: "visible", timeout: 15_000 });
    await idInput.fill(ID);
    await page.locator('input[name="user_login_pw"]').first().fill(PW);

    // id 입력칸의 조상 td → 그 형제 td 안의 img
    const loginImg = idInput
      .locator("xpath=./ancestor::td[1]/following-sibling::td//img")
      .first();
    await loginImg.waitFor({ state: "visible", timeout: 5_000 });
    await loginImg.click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    console.log(`  → 로그인 후 URL: ${page.url()}`);

    console.log(`[3/5] 검색어 입력 + 검색 ("${SEARCH_KEYWORD}")`);
    const searchInput = page.locator("input#ser_keyword").first();
    await searchInput.waitFor({ state: "visible", timeout: 15_000 });
    await searchInput.fill(SEARCH_KEYWORD);

    // input#ser_keyword 의 다음 형제 img
    const searchImg = searchInput
      .locator("xpath=./following-sibling::img[1]")
      .first();
    await searchImg.waitFor({ state: "visible", timeout: 5_000 });
    await searchImg.click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    console.log(`  → 검색 후 URL: ${page.url()}`);

    console.log("[4/5] #table_price_ tbody 첫 행의 td > a 링크 확인 + 클릭");
    const firstLink = page
      .locator("#table_price_ > tbody > tr:nth-child(1) > td > a")
      .first();
    const linkExists = (await firstLink.count()) > 0;
    const linkVisible = linkExists
      ? await firstLink.isVisible().catch(() => false)
      : false;
    console.log(`  → 링크 존재: ${linkExists}, 가시성: ${linkVisible}`);

    if (!linkExists || !linkVisible) {
      console.log("  → 접근 가능한 링크가 없어 상세 추출 단계 생략");
      console.log("\n브라우저는 30초 후 자동 종료. (Ctrl+C 로 즉시 종료)");
      await page.waitForTimeout(30_000);
      return;
    }

    const linkText =
      (await firstLink.textContent())
        ?.replace(/\s+/g, " ")
        .trim()
        .slice(0, 100) ?? "";
    console.log(`  → 클릭 대상: "${linkText}"`);

    const popupPromise = context
      .waitForEvent("page", { timeout: 5_000 })
      .catch(() => null);
    await firstLink.click();
    const popup = await popupPromise;
    if (popup) {
      page = popup;
      await page.waitForLoadState("domcontentloaded");
      console.log(`  → 새 탭: ${page.url()}`);
    } else {
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});
      console.log(`  → 같은 탭: ${page.url()}`);
    }

    console.log("[5/5] table.tbtype03 추출 + JSON 저장");
    const detailTable = page.locator("table.tbtype03").first();
    await detailTable.waitFor({ state: "visible", timeout: 20_000 });
    const result = await extractTable(detailTable);
    console.log(
      `  → 행 수: ${result.rows.length}, headerRows(${result.headerRows.length}):`
    );
    result.headerRows.forEach((row, i) =>
      console.log(`     [${i}] ${JSON.stringify(row)}`)
    );
    console.log(`  → leaf headers: ${JSON.stringify(result.headers)}`);

    mkdirSync("data", { recursive: true });
    const safeKeyword = SEARCH_KEYWORD.replace(/\s+/g, "_");
    const outPath = join(projectRoot, "data", `cmpi-${safeKeyword}.json`);
    const payload = {
      source: "대한건설협회 거래가격 (cmpi.or.kr)",
      keyword: SEARCH_KEYWORD,
      sourceUrl: page.url(),
      fetchedAt: new Date().toISOString(),
      headers: result.headers,
      headerRows: result.headerRows,
      rows: result.rows,
    };
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
    console.log(`  → 저장 완료: ${outPath}`);

    console.log("\n브라우저는 30초 후 자동 종료. (Ctrl+C 로 즉시 종료)");
    await page.waitForTimeout(30_000);
  } finally {
    await browser.close();
  }
}

async function extractTable(table: Locator): Promise<ExtractedTable> {
  // 1) thead 안의 모든 행을 캡처
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

  // leaf 행 = 마지막 thead 행 (계층 헤더가 있을 때 실제 컬럼 키)
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
