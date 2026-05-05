import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../prisma";
import { scrape } from "../scrapers";
import { normalizeForSource } from "../normalizers";
import type { ScrapeSource } from "../scrapers/types";
import { buildEmbeddingText, embedTexts } from "../openai/embed";

const ENV_KEYS: Record<ScrapeSource, { id: string; pw: string }> = {
  kpi: { id: "KPI_ID", pw: "KPI_PW" },
  kprc: { id: "KPRC_ID", pw: "KPRC_PW" },
  cmpi: { id: "CMPI_ID", pw: "CMPI_PW" },
};

export interface RunScrapeResult {
  scrapeRunId: number;
  source: ScrapeSource;
  keyword: string;
  sourceUrl: string;
  rowCount: number;
  normalizedCount: number;
  embeddedCount: number;
  fetchedAt: string;
}

export interface RunScrapeOptions {
  headless?: boolean;
  log?: (msg: string) => void;
}

/**
 * scrape → normalize → DB(ScrapeRun + PriceHistory cascade insert) 1회 실행.
 * 호출 전에 .env / .env.local 이 process.env 에 로드되어 있어야 함.
 */
export async function runScrape(
  source: ScrapeSource,
  keyword: string,
  options: RunScrapeOptions = {}
): Promise<RunScrapeResult> {
  const keys = ENV_KEYS[source];
  const id = process.env[keys.id];
  const pw = process.env[keys.pw];
  if (!id || !pw) {
    throw new Error(
      `Missing credentials in env: ${keys.id} / ${keys.pw}`
    );
  }

  const scraped = await scrape(source, { id, pw }, keyword, {
    headless: options.headless ?? true,
    log: options.log,
  });

  const normalized = normalizeForSource(source, scraped);
  const fetchedAt = new Date(scraped.fetchedAt);

  const run = await prisma.scrapeRun.create({
    data: {
      source,
      keyword,
      sourceUrl: scraped.sourceUrl,
      fetchedAt,
      rawHeaders: scraped.headerRows,
      rawRows: scraped.rows,
      prices: {
        create: normalized.map((n) => ({
          source,
          fetchedAt,
          itemName: n.itemName,
          spec: n.spec,
          unit: n.unit,
          region: n.region,
          price: n.price,
          currency: n.currency,
          extras: n.extras,
        })),
      },
    },
    include: { prices: { select: { id: true, itemName: true, spec: true } } },
  });

  // 임베딩 일괄 생성 후 update (실패해도 스크랩 결과는 보존)
  let embeddedCount = 0;
  try {
    const texts = run.prices.map((p) =>
      buildEmbeddingText(p.itemName, p.spec)
    );
    const vectors = await embedTexts(texts);
    await prisma.$transaction(
      run.prices.map((p, i) =>
        prisma.priceHistory.update({
          where: { id: p.id },
          data: { embedding: vectors[i] as Prisma.InputJsonValue },
        })
      )
    );
    embeddedCount = vectors.length;
  } catch (err) {
    options.log?.(
      `[runScrape] 임베딩 실패 (스크랩은 보존됨): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return {
    scrapeRunId: run.id,
    source,
    keyword,
    sourceUrl: scraped.sourceUrl,
    rowCount: scraped.rows.length,
    normalizedCount: normalized.length,
    embeddedCount,
    fetchedAt: scraped.fetchedAt,
  };
}
