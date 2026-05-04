import { chromium, type Page, type Locator } from "playwright";
import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HOME_URL = "https://www.kprc.or.kr/";
const SEARCH_KEYWORD = "폴리카보네이트 복층판";

interface ExtractedTable {
  headers: string[];
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

  const ID = process.env.KPRC_ID;
  const PW = process.env.KPRC_PW;
  if (!ID || !PW) {
    console.error("[ERROR] .env.local 에 KPRC_ID, KPRC_PW 가 필요합니다.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await browser.newContext();
  let page = await context.newPage();

  try {
    console.log(`[1/8] 홈 진입: ${HOME_URL}`);
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

    console.log(
      "[2/8] 첫 진입 팝업 닫기 (div.popup-btn-area > .btn-close-popup)"
    );
    await dismissPopup(page);

    console.log("[3/8] 헤더 메뉴의 '로그인' 버튼 클릭");
    const loginBtn = page
      .locator("#goToLogin")
      .filter({ hasText: "로그인" })
      .first();
    await loginBtn.waitFor({ state: "visible", timeout: 10_000 });
    await loginBtn.click();

    console.log("[4/8] 로그인 모달에 ID/PW 입력 + #loginBtn");
    const modal = page.locator("section#login").first();
    await modal.waitFor({ state: "visible", timeout: 10_000 });
    const form = modal.locator("form[name='loginForm']").first();
    await form.locator("input#userID").fill(ID);
    await form.locator("input#userPass").fill(PW);
    await page.locator("#loginBtn").click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});

    // 로그인 후 홈으로 돌아가서 검색창 사용
    if (!page.url().startsWith(HOME_URL)) {
      console.log(`  → 로그인 후 ${page.url()} → 홈으로 복귀`);
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    } else {
      console.log(`  → 로그인 후 URL: ${page.url()}`);
    }

    console.log(`[5/8] 검색어 입력 + 검색 ("${SEARCH_KEYWORD}")`);
    const searchInput = page.locator("#input_qt2").first();
    await searchInput.waitFor({ state: "visible", timeout: 15_000 });
    await searchInput.fill(SEARCH_KEYWORD);
    const submitBtn = page
      .locator(
        "div.main-search-area > form[name='RsaSearchForm2'] > fieldset > div > div.search-area > button"
      )
      .first();
    console.log(`  → 검색 버튼: ${await submitBtn.count()}`);
    await submitBtn.click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    await page
      .locator("#div_results")
      .waitFor({ state: "visible", timeout: 15_000 });
    console.log(`  → 검색 결과 URL: ${page.url()}`);

    console.log('[6/8] "물가자료" 그룹의 첫 .result-node.tmpl_node 클릭');
    const mulgaGroup = page
      .locator("#div_results > .total-section > .both-float")
      .filter({ has: page.locator('p.title:has-text("물가자료")') })
      .first();
    if (
      !(await mulgaGroup
        .waitFor({ state: "attached", timeout: 15_000 })
        .then(() => true)
        .catch(() => false))
    ) {
      throw new Error("물가자료 그룹을 찾지 못했습니다.");
    }
    const resultDiv = mulgaGroup.locator(
      "xpath=./following-sibling::div[contains(concat(' ', normalize-space(@class), ' '), ' result ')][1]"
    );
    const firstNode = resultDiv.locator(".result-node.tmpl_node > a").first();
    await firstNode.waitFor({ state: "visible", timeout: 10_000 });
    const nodeText =
      (await firstNode.textContent())
        ?.replace(/\s+/g, " ")
        .trim()
        .slice(0, 100) ?? "";
    console.log(`  → 클릭 대상: "${nodeText}"`);

    const popupPromise = context
      .waitForEvent("page", { timeout: 5_000 })
      .catch(() => null);
    await firstNode.click();
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

    console.log("[7/8] div.table-list01 > table 추출 + 페이지네이션 순회");
    const result = await paginateAndExtract(page);
    console.log(
      `  → 총 ${result.rows.length}개 행, 헤더(${
        result.headers.length
      }): ${JSON.stringify(result.headers)}`
    );

    console.log("[8/8] JSON 저장");
    mkdirSync("data", { recursive: true });
    const safeKeyword = SEARCH_KEYWORD.replace(/\s+/g, "_");
    const outPath = join(projectRoot, "data", `kprc-${safeKeyword}.json`);
    const payload = {
      source: "한국물가협회 (kprc.or.kr)",
      keyword: SEARCH_KEYWORD,
      sourceUrl: page.url(),
      fetchedAt: new Date().toISOString(),
      headers: result.headers,
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
  const headerCells = await table
    .locator("thead tr")
    .last()
    .locator("th, td")
    .allInnerTexts()
    .catch(() => [] as string[]);
  const headers = headerCells.map((h) => h.replace(/\s+/g, " ").trim());

  const rowsLoc = table.locator("tbody tr");
  const rowCount = await rowsLoc.count();
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row = rowsLoc.nth(i);
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
  return { headers, rows };
}

async function paginateAndExtract(page: Page): Promise<ExtractedTable> {
  const tableSel = "div.table-list01 > table";
  const initial = page.locator(tableSel).first();
  await initial.waitFor({ state: "visible", timeout: 20_000 });

  let headers: string[] = [];
  const allRows: Record<string, string>[] = [];

  let currentPage = 1;
  const MAX_ITER = 200;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const t = page.locator(tableSel).first();
    await t.waitFor({ state: "visible", timeout: 15_000 });
    const r = await extractTable(t);
    if (headers.length === 0) headers = r.headers;
    console.log(`    Page ${currentPage}: ${r.rows.length}개 행`);
    allRows.push(...r.rows);

    const paging = page.locator("div#pagingDiv, div.pagination").first();
    if ((await paging.count()) === 0) break;

    const nextNum = currentPage + 1;
    const numRe = new RegExp(`^\\s*${nextNum}\\s*$`);

    const nextNumLink = paging
      .locator("a, button")
      .filter({ hasText: numRe })
      .first();
    if (await isClickable(nextNumLink)) {
      await nextNumLink.click();
      await page
        .waitForLoadState("networkidle", { timeout: 10_000 })
        .catch(() => {});
      await page.waitForTimeout(400);
      currentPage = nextNum;
      continue;
    }

    // 다음 페이지 그룹 (다음 / > / »)
    const nextGroup = paging
      .locator("a, button")
      .filter({ hasText: /^(다음|next|»|>)$/i })
      .first();
    if (await isClickable(nextGroup)) {
      await nextGroup.click();
      await page
        .waitForLoadState("networkidle", { timeout: 10_000 })
        .catch(() => {});
      await page.waitForTimeout(400);
      const reCheck = paging
        .locator("a, button")
        .filter({ hasText: numRe })
        .first();
      if (await isClickable(reCheck)) {
        await reCheck.click();
        await page
          .waitForLoadState("networkidle", { timeout: 10_000 })
          .catch(() => {});
        await page.waitForTimeout(400);
        currentPage = nextNum;
        continue;
      }
      console.log(`    → next 그룹 눌렀으나 페이지 ${nextNum} 없음, 종료`);
      break;
    }

    break;
  }

  return { headers, rows: allRows };
}

async function isClickable(loc: Locator): Promise<boolean> {
  if ((await loc.count()) === 0) return false;
  return await loc.isVisible().catch(() => false);
}

async function dismissPopup(p: Page): Promise<void> {
  const labelRe = /하루\s*동안\s*보지\s*않/;
  const MAX_POPUPS = 5;

  for (let i = 0; i < MAX_POPUPS; i++) {
    const area = p.locator("div.popup-btn-area").first();
    if (!(await area.isVisible({ timeout: 2000 }).catch(() => false))) {
      if (i === 0) console.log("  → 팝업 없음, 스킵");
      else console.log(`  → 추가 팝업 없음 (총 ${i}개 닫음)`);
      return;
    }

    // '하루동안 보지 않기' 체크박스 (커스텀 UI: span.check)
    const checkSpan = area.locator("span.check").first();
    let checked = false;
    if (await checkSpan.isVisible().catch(() => false)) {
      await checkSpan.click();
      checked = true;
    } else {
      // 변형 fallback: 표준 checkbox 가 있을 가능성
      const fallback = area.getByLabel(labelRe).first();
      if ((await fallback.count()) > 0) {
        await fallback.check().catch(() => {});
        checked = true;
      }
    }

    const closeBtn = area.locator(".btn-close-popup").first();
    if (!(await closeBtn.isVisible({ timeout: 1000 }).catch(() => false))) {
      console.log(`  → 팝업 #${i + 1}: .btn-close-popup 가 안 보여 종료`);
      return;
    }
    await closeBtn.click();
    await p.waitForTimeout(400);
    console.log(`  → 팝업 #${i + 1} 닫음 (하루동안 보지 않기 체크=${checked})`);
  }
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});
