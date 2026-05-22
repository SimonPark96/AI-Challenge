import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrapeKpi } from "../src/lib/scrapers";

const SEARCH_KEYWORD = "폴리카보네이트 복층판";

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

  const result = await scrapeKpi(
    { id: ID, pw: PW },
    SEARCH_KEYWORD,
    { headless: false, slowMo: 500, observeMs: 30_000, log: console.log }
  );

  console.log(
    `\n  → 행 수: ${result.rows.length}, headerRows(${result.headerRows.length}):`
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
    sourceUrl: result.sourceUrl,
    fetchedAt: result.fetchedAt,
    headers: result.headers,
    headerRows: result.headerRows,
    rows: result.rows,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`  → 저장 완료: ${outPath}`);
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});
