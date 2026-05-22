export type ScrapeSource = "kpi" | "kprc" | "cmpi";

export interface Credentials {
  id: string;
  pw: string;
}

export interface ScrapeOptions {
  headless?: boolean;
  slowMo?: number;
  observeMs?: number; // verify 모드에서 종료 전 대기 (디버깅용)
  log?: (msg: string) => void;
}

export interface ExtractedTable {
  headers: string[];
  headerRows: string[][];
  rows: Record<string, string>[];
}

export interface ScrapedTable extends ExtractedTable {
  source: ScrapeSource;
  keyword: string;
  sourceUrl: string;
  fetchedAt: string; // ISO
}
