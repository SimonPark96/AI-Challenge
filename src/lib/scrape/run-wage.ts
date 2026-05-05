import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../prisma";
import { scrapeKpiWages } from "../scrapers/kpi-wage";
import { buildEmbeddingText, embedTexts } from "../openai/embed";

export const WAGE_SOURCE = "kpi-wage";
export const WAGE_CATE_CDS: readonly string[] = ["701111", "701115"];

export interface RunWageResult {
  source: string;
  fetchedAt: string;
  categories: Array<{
    cateCd: string;
    sourceUrl: string;
    wageRunId: number;
    rowCount: number;
  }>;
  totalRows: number;
  // swap 결과 — 모든 카테고리가 성공적으로 추출됐을 때만 적용
  committed: boolean;
  purgedWageRuns: number;
  rolledBackWageRuns: number;
}

export interface RunWageOptions {
  log?: (msg: string) => void;
}

export interface ScrapeAndInsertWagesResult {
  newWageRunIds: number[];
  totalRows: number;
  categories: RunWageResult["categories"];
  allHaveRows: boolean; // 모든 카테고리에서 1행 이상 추출됐는지
}

/**
 * 스크래핑 + WageRun/WageHistory 신규 INSERT 까지만. swap/rollback 은 호출자가 결정.
 * 자동 스케줄러처럼 자재 단가와 함께 트랜잭션을 묶을 때 사용.
 */
export async function scrapeAndInsertWages(
  options: RunWageOptions = {}
): Promise<ScrapeAndInsertWagesResult> {
  const log = options.log ?? (() => {});
  const ID = process.env.KPI_ID;
  const PW = process.env.KPI_PW;
  if (!ID || !PW) {
    throw new Error("Missing credentials in env: KPI_ID / KPI_PW");
  }

  const scraped = await scrapeKpiWages({ id: ID, pw: PW }, WAGE_CATE_CDS, {
    headless: true,
    log,
  });

  const newWageRunIds: number[] = [];
  const categories: RunWageResult["categories"] = [];
  let totalRows = 0;
  let allHaveRows = scraped.length === WAGE_CATE_CDS.length;

  for (const cat of scraped) {
    if (cat.rows.length === 0) {
      log(`  → ${cat.cateCd} 0행 — 실패로 간주`);
      allHaveRows = false;
      continue;
    }
    const fetchedAt = new Date(cat.fetchedAt);
    const run = await prisma.wageRun.create({
      data: {
        source: WAGE_SOURCE,
        cateCd: cat.cateCd,
        sourceUrl: cat.sourceUrl,
        fetchedAt,
        wages: {
          create: cat.rows.map((r) => ({
            cateCd: cat.cateCd,
            jobName: r.jobName,
            price: r.price,
            unit: r.unit,
            basis: r.basis,
            description: r.description,
            fetchedAt,
          })),
        },
      },
      include: {
        wages: { select: { id: true, jobName: true } },
      },
    });
    newWageRunIds.push(run.id);
    categories.push({
      cateCd: cat.cateCd,
      sourceUrl: cat.sourceUrl,
      wageRunId: run.id,
      rowCount: run.wages.length,
    });
    totalRows += run.wages.length;

    // 임베딩 일괄 생성 후 update — 실패해도 스크랩 결과는 보존.
    try {
      const texts = run.wages.map((w) => buildEmbeddingText(w.jobName));
      const vectors = await embedTexts(texts);
      await prisma.$transaction(
        run.wages.map((w, i) =>
          prisma.wageHistory.update({
            where: { id: w.id },
            data: { embedding: vectors[i] as Prisma.InputJsonValue },
          })
        )
      );
      log(`  → ${cat.cateCd}: 임베딩 ${vectors.length}개 적재`);
    } catch (err) {
      log(
        `  → ${cat.cateCd}: 임베딩 실패 (스크랩은 보존됨): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return { newWageRunIds, totalRows, categories, allHaveRows };
}

/**
 * KPI 노임단가 1회 스크래핑 (수동 실행 진입점).
 * - 모든 카테고리에서 1행 이상 추출 → swap (이전 WageRun 모두 삭제)
 * - 한 카테고리라도 0건이거나 throw → rollback (신규 WageRun 삭제, 기존 유지)
 */
export async function runWageScrape(
  options: RunWageOptions = {}
): Promise<RunWageResult> {
  const log = options.log ?? (() => {});
  const inserted = await scrapeAndInsertWages(options);

  let purgedWageRuns = 0;
  let rolledBackWageRuns = 0;
  let committed = false;

  if (
    inserted.allHaveRows &&
    inserted.newWageRunIds.length === WAGE_CATE_CDS.length
  ) {
    const swap = await prisma.wageRun.deleteMany({
      where: { id: { notIn: inserted.newWageRunIds } },
    });
    purgedWageRuns = swap.count;
    committed = true;
    log(
      `  → commit: 이전 WageRun ${purgedWageRuns}개 삭제, 신규 ${inserted.newWageRunIds.length}개 적용`
    );
  } else if (inserted.newWageRunIds.length > 0) {
    const rb = await prisma.wageRun.deleteMany({
      where: { id: { in: inserted.newWageRunIds } },
    });
    rolledBackWageRuns = rb.count;
    log(`  → rollback: 신규 WageRun ${rolledBackWageRuns}개 삭제 (기존 유지)`);
  } else {
    log("  → 신규 데이터 없음, 기존 유지");
  }

  return {
    source: WAGE_SOURCE,
    fetchedAt: new Date().toISOString(),
    categories: inserted.categories,
    totalRows: inserted.totalRows,
    committed,
    purgedWageRuns,
    rolledBackWageRuns,
  };
}
