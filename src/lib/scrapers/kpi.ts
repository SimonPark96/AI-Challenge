import { chromium } from "playwright";
import { extractTable } from "./extract-table";
import type { Credentials, ScrapeOptions, ScrapedTable } from "./types";

const LOGIN_URL = "https://www.kpi.or.kr/www/member/login.asp";

export async function scrapeKpi(
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
  const page = await context.newPage();

  try {
    log(`[1/9] 로그인 페이지 진입: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

    log("[2/9] 아이디 입력 (#user_id)");
    await page.locator("#user_id").fill(creds.id);

    log("[3/9] 비밀번호 입력 (#user_pw)");
    await page.locator("#user_pw").fill(creds.pw);

    log("[4/9] 로그인 버튼 클릭 (#sendLogin)");
    await page.locator("#sendLogin").click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    log(`  → 로그인 후 URL: ${page.url()}`);

    log(
      "[5/9] 모달 닫기 (.modal_container > .join_footer > .btn.btn_close)"
    );
    const closeBtn = page
      .locator(".modal_container > .join_footer > .btn.btn_close")
      .first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      log("  → 모달 닫음");
    } else {
      log("  → 모달 없음, 스킵");
    }

    log(`[6/9] 검색어 입력 "${keyword}" (input#q)`);
    const searchInput = page.locator(
      "div.ser-ban > form > div.top_search > input#q"
    );
    await searchInput.waitFor({ state: "visible", timeout: 10_000 });
    await searchInput.fill(keyword);

    log("[7/9] 검색 버튼 클릭 (button.search) → /search/ 도달 대기");
    const searchBtn = page.locator("div.ser-ban > form > button.search");
    await Promise.all([
      page.waitForURL(/\/search\//, { timeout: 20_000 }),
      searchBtn.click(),
    ]);
    await page.waitForLoadState("domcontentloaded");
    log(`  → 검색 결과 URL: ${page.url()}`);

    log("[8/9] 물가정보 결과 첫 아이템 클릭 → 상세 페이지");
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

    let detailPage = page;
    const popupPromise = context
      .waitForEvent("page", { timeout: 5_000 })
      .catch(() => null);
    await target.click();
    const popup = await popupPromise;
    if (popup) {
      detailPage = popup;
      await popup.waitForLoadState("domcontentloaded");
      log(`  → 상세 페이지 (새 탭): ${detailPage.url()}`);
    } else {
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});
      log(`  → 상세 페이지 (같은 탭): ${detailPage.url()}`);
    }

    log("[9/9] div.detl-wro.price-tb > table 추출");
    const priceTable = detailPage
      .locator(
        "div.detl-wro.price-tb > table, div.detl-wro .price-tb > table, div.detl-wro table.price-tb, div.detl-wro > table"
      )
      .first();
    await priceTable.waitFor({ state: "visible", timeout: 20_000 });
    const result = await extractTable(priceTable);
    log(
      `  → 행 수: ${result.rows.length}, headerRows(${result.headerRows.length})`
    );

    if (observeMs > 0) {
      log(`\n브라우저는 ${observeMs / 1000}초 후 자동 종료.`);
      await detailPage.waitForTimeout(observeMs);
    }

    return {
      source: "kpi",
      keyword,
      sourceUrl: detailPage.url(),
      fetchedAt: new Date().toISOString(),
      ...result,
    };
  } finally {
    await browser.close();
  }
}
