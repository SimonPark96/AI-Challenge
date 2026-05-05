import { chromium } from "playwright";
import { extractTable } from "./extract-table";
import type { Credentials, ScrapeOptions, ScrapedTable } from "./types";

const HOME_URL = "https://cmpi.or.kr/frame/";

export async function scrapeCmpi(
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
    log(`[1/5] 진입: ${HOME_URL}`);
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

    log("[2/5] 로그인 (id/pw 입력 + 형제 td > img 클릭)");
    const idInput = page.locator('input[name="user_login_id"]').first();
    await idInput.waitFor({ state: "visible", timeout: 15_000 });
    await idInput.fill(creds.id);
    await page.locator('input[name="user_login_pw"]').first().fill(creds.pw);
    const loginImg = idInput
      .locator("xpath=./ancestor::td[1]/following-sibling::td//img")
      .first();
    await loginImg.waitFor({ state: "visible", timeout: 5_000 });
    await loginImg.click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    log(`  → 로그인 후 URL: ${page.url()}`);

    log(`[3/5] 검색어 입력 + 검색 ("${keyword}")`);
    const searchInput = page.locator("input#ser_keyword").first();
    await searchInput.waitFor({ state: "visible", timeout: 15_000 });
    await searchInput.fill(keyword);
    const searchImg = searchInput
      .locator("xpath=./following-sibling::img[1]")
      .first();
    await searchImg.waitFor({ state: "visible", timeout: 5_000 });
    await searchImg.click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    log(`  → 검색 후 URL: ${page.url()}`);

    log("[4/5] #table_price_ tbody 첫 행 td > a 확인 + 클릭");
    const firstLink = page
      .locator("#table_price_ > tbody > tr:nth-child(1) > td > a")
      .first();
    const linkExists = (await firstLink.count()) > 0;
    const linkVisible = linkExists
      ? await firstLink.isVisible().catch(() => false)
      : false;
    log(`  → 링크 존재=${linkExists}, 가시성=${linkVisible}`);

    if (!linkExists || !linkVisible) {
      log("  → 결과 링크 없음 — 빈 테이블 반환");
      if (observeMs > 0) await page.waitForTimeout(observeMs);
      return {
        source: "cmpi",
        keyword,
        sourceUrl: page.url(),
        fetchedAt: new Date().toISOString(),
        headers: [],
        headerRows: [],
        rows: [],
      };
    }

    const popupPromise = context
      .waitForEvent("page", { timeout: 5_000 })
      .catch(() => null);
    await firstLink.click();
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

    log("[5/5] table.tbtype03 추출");
    const detailTable = page.locator("table.tbtype03").first();
    await detailTable.waitFor({ state: "visible", timeout: 20_000 });
    const result = await extractTable(detailTable);
    log(
      `  → 행 수: ${result.rows.length}, headerRows(${result.headerRows.length})`
    );

    if (observeMs > 0) {
      log(`\n브라우저는 ${observeMs / 1000}초 후 자동 종료.`);
      await page.waitForTimeout(observeMs);
    }

    return {
      source: "cmpi",
      keyword,
      sourceUrl: page.url(),
      fetchedAt: new Date().toISOString(),
      ...result,
    };
  } finally {
    await browser.close();
  }
}
