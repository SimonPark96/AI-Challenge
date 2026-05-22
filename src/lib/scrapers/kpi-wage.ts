import { chromium, type Page } from "playwright";
import { autoAcceptDialogs } from "./dialog";
import type { Credentials, ScrapeOptions } from "./types";

const LOGIN_URL = "https://www.kpi.or.kr/www/member/login.asp";

export interface WageRowRaw {
  jobName: string;
  price: number | null;
  unit: string | null;
  basis: string | null;
  description: string | null;
}

export interface WageScrapedCategory {
  cateCd: string;
  sourceUrl: string;
  fetchedAt: string;
  rows: WageRowRaw[];
}

/**
 * KPI 의 노임단가 페이지(wage_list.asp?CATE_CD=...) 를 카테고리별로 순회해 추출.
 * 페이지 구조: div.table-paycount > table > tbody > tr 안에 5컬럼
 *   [직종명, 단가, 단위, 기준, 해설]
 * tbody 첫 행은 사실상 헤더 — 스킵.
 */
export async function scrapeKpiWages(
  creds: Credentials,
  cateCds: readonly string[],
  options: ScrapeOptions = {}
): Promise<WageScrapedCategory[]> {
  const headless = options.headless ?? true;
  const slowMo = options.slowMo ?? 0;
  const log = options.log ?? (() => {});

  const browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext();
  autoAcceptDialogs(context, log);
  const page = await context.newPage();

  try {
    log(`[1/3] 로그인: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.locator("#user_id").fill(creds.id);
    await page.locator("#user_pw").fill(creds.pw);
    await page.locator("#sendLogin").click();
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
    log(`  → 로그인 후 URL: ${page.url()}`);
    if (/member\/login\.asp/i.test(page.url())) {
      throw new Error(
        `KPI 로그인 실패: ${page.url()} (자격증명 또는 셀렉터 확인)`
      );
    }

    // 로그인 직후 모달이 뜨면 닫기 (kpi.ts 의 동일 로직)
    const closeBtn = page
      .locator(".modal_container > .join_footer > .btn.btn_close")
      .first();
    if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
      log("  → 로그인 후 모달 닫음");
    }

    const out: WageScrapedCategory[] = [];
    for (let i = 0; i < cateCds.length; i++) {
      const cateCd = cateCds[i];
      const url = `https://www.kpi.or.kr/www/price/wage_list.asp?CATE_CD=${cateCd}`;
      log(`[2/3] (${i + 1}/${cateCds.length}) ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});

      const rows = await extractWageRows(page, log);
      log(`  → 추출된 행 수: ${rows.length}`);
      out.push({
        cateCd,
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        rows,
      });
    }

    log(`[3/3] 완료 — 총 ${out.length}개 카테고리`);
    return out;
  } finally {
    await browser.close();
  }
}

async function extractWageRows(
  page: Page,
  log: (msg: string) => void
): Promise<WageRowRaw[]> {
  const tbody = page.locator("div.table-paycount > table > tbody").first();
  await tbody.waitFor({ state: "visible", timeout: 15_000 });
  const trs = tbody.locator("tr");
  const total = await trs.count();
  const rows: WageRowRaw[] = [];

  for (let i = 0; i < total; i++) {
    const cells = await trs
      .nth(i)
      .locator("th, td")
      .allInnerTexts();
    const cleaned = cells.map((c) => c.replace(/\s+/g, " ").trim());

    // 헤더 행 스킵
    if (cleaned[0] === "직종명") continue;
    if (cleaned.length < 1 || !cleaned[0]) continue;

    rows.push({
      jobName: cleaned[0],
      price: parseWon(cleaned[1] ?? ""),
      unit: cleaned[2] || null,
      basis: cleaned[3] || null,
      description: cleaned[4] || null,
    });
  }
  if (total === 0) log("  → tbody 비어있음");
  return rows;
}

function parseWon(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[,\s원₩￦]/g, "").trim();
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
