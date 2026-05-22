export { scrapeKpi } from "./kpi";
export { scrapeKprc } from "./kprc";
export { scrapeCmpi } from "./cmpi";
export type {
  ScrapeSource,
  Credentials,
  ScrapeOptions,
  ScrapedTable,
  ExtractedTable,
} from "./types";

import type { Credentials, ScrapeOptions, ScrapedTable, ScrapeSource } from "./types";
import { scrapeKpi } from "./kpi";
import { scrapeKprc } from "./kprc";
import { scrapeCmpi } from "./cmpi";

export async function scrape(
  source: ScrapeSource,
  creds: Credentials,
  keyword: string,
  options?: ScrapeOptions
): Promise<ScrapedTable> {
  switch (source) {
    case "kpi":
      return scrapeKpi(creds, keyword, options);
    case "kprc":
      return scrapeKprc(creds, keyword, options);
    case "cmpi":
      return scrapeCmpi(creds, keyword, options);
  }
}
