import { chromium, type Locator, type Page } from "playwright";
import { extractTable } from "./extract-table";
import type {
  Credentials,
  ExtractedTable,
  ScrapeOptions,
  ScrapedTable,
} from "./types";

const HOME_URL = "https://www.kprc.or.kr/";

export async function scrapeKprc(
  creds: Credentials,
  keyword: string,
  options: ScrapeOptions = {}
): Promise<ScrapedTable> {
  const headless = options.headless ?? true;
  const slowMo = options.slowMo ?? 0;
  const observeMs = options.observeMs ?? 0;
  const log = options.log ?? (() => {});

  const browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext();
  let page = await context.newPage();

  try {
    log(`[1/8] 홈 진입: ${HOME_URL}`);
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

    log("[2/8] 첫 진입 팝업 닫기");
    await dismissPopup(page, log);

    log("[3/8] 헤더 메뉴의 '로그인' 버튼 클릭");
    const loginBtn = page
      .locator("#goToLogin")
      .filter({ hasText: "로그인" })
      .first();
    await loginBtn.waitFor({ state: "visible", timeout: 10_000 });
    await loginBtn.click();

    log("[4/8] 로그인 모달에 ID/PW 입력 + #loginBtn");
    const modal = page.locator("section#login").first();
    await modal.waitFor({ state: "visible", timeout: 10_000 });
    const form = modal.locator("form[name='loginForm']").first();
    await form.locator("input#userID").fill(creds.id);
    await form.locator("input#userPass").fill(creds.pw);
    await page.locator("#loginBtn").click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});

    if (!page.url().startsWith(HOME_URL)) {
      log(`  → 로그인 후 ${page.url()} → 홈으로 복귀`);
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    } else {
      log(`  → 로그인 후 URL: ${page.url()}`);
    }

    log(`[5/8] 검색어 입력 + 검색 ("${keyword}")`);
    const searchInput = page.locator("#input_qt2").first();
    await searchInput.waitFor({ state: "visible", timeout: 15_000 });
    await searchInput.fill(keyword);
    const submitBtn = page
      .locator(
        "div.main-search-area > form[name='RsaSearchForm2'] > fieldset > div > div.search-area > button"
      )
      .first();
    await submitBtn.click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    await page
      .locator("#div_results")
      .waitFor({ state: "visible", timeout: 15_000 });
    log(`  → 검색 결과 URL: ${page.url()}`);

    log('[6/8] "물가자료" 그룹의 첫 .result-node.tmpl_node 클릭');
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
    // 첫 번째 result-node 안에서 마지막 a 태그
    const targetNode = resultDiv
      .locator(".result-node.tmpl_node")
      .first()
      .locator("a")
      .last();
    await targetNode.waitFor({ state: "visible", timeout: 10_000 });

    const popupPromise = context
      .waitForEvent("page", { timeout: 5_000 })
      .catch(() => null);
    await targetNode.click();
    const popup = await popupPromise;
    if (popup) {
      page = popup;
      await page.waitForLoadState("domcontentloaded");
      log(`  → 새 탭: ${page.url()}`);
    } else {
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});
      log(`  → 같은 탭: ${page.url()}`);
    }

    log("[7/8] div.table-list01 > table 추출 + 페이지네이션 순회");
    const result = await paginateAndExtract(page, log);
    log(
      `  → 총 ${result.rows.length}개 행, headerRows(${result.headerRows.length})`
    );

    if (observeMs > 0) {
      log(`\n브라우저는 ${observeMs / 1000}초 후 자동 종료.`);
      await page.waitForTimeout(observeMs);
    }

    return {
      source: "kprc",
      keyword,
      sourceUrl: page.url(),
      fetchedAt: new Date().toISOString(),
      ...result,
    };
  } finally {
    await browser.close();
  }
}

async function dismissPopup(
  p: Page,
  log: (msg: string) => void
): Promise<void> {
  const labelRe = /하루\s*동안\s*보지\s*않/;
  const MAX_POPUPS = 5;

  for (let i = 0; i < MAX_POPUPS; i++) {
    const area = p.locator("div.popup-btn-area").first();
    if (!(await area.isVisible({ timeout: 2000 }).catch(() => false))) {
      if (i === 0) log("  → 팝업 없음, 스킵");
      else log(`  → 추가 팝업 없음 (총 ${i}개 닫음)`);
      return;
    }

    // '하루동안 보지 않기' 체크박스 (커스텀 UI: span.check)
    const checkSpan = area.locator("span.check").first();
    let checked = false;
    if (await checkSpan.isVisible().catch(() => false)) {
      await checkSpan.click();
      checked = true;
    } else {
      const fallback = area.getByLabel(labelRe).first();
      if ((await fallback.count()) > 0) {
        await fallback.check().catch(() => {});
        checked = true;
      }
    }

    const closeBtn = area.locator(".btn-close-popup").first();
    if (!(await closeBtn.isVisible({ timeout: 1000 }).catch(() => false))) {
      log(`  → 팝업 #${i + 1}: .btn-close-popup 없어 종료`);
      return;
    }
    await closeBtn.click();
    await p.waitForTimeout(400);
    log(`  → 팝업 #${i + 1} 닫음 (보지 않기 체크=${checked})`);
  }
}

async function paginateAndExtract(
  page: Page,
  log: (msg: string) => void
): Promise<ExtractedTable> {
  const tableSel = "div.table-list01 > table";
  const initial = page.locator(tableSel).first();
  await initial.waitFor({ state: "visible", timeout: 20_000 });

  let headers: string[] = [];
  let headerRows: string[][] = [];
  const allRows: Record<string, string>[] = [];

  let currentPage = 1;
  const MAX_ITER = 200;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const t = page.locator(tableSel).first();
    await t.waitFor({ state: "visible", timeout: 15_000 });
    const r = await extractTable(t);
    if (headerRows.length === 0) {
      headers = r.headers;
      headerRows = r.headerRows;
    }
    log(`    Page ${currentPage}: ${r.rows.length}개 행`);
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
      log(`    → next 그룹 눌렀으나 페이지 ${nextNum} 없음, 종료`);
      break;
    }

    break;
  }

  return { headers, headerRows, rows: allRows };
}

async function isClickable(loc: Locator): Promise<boolean> {
  if ((await loc.count()) === 0) return false;
  return await loc.isVisible().catch(() => false);
}
