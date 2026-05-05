import cron from "node-cron";
import { runScrape } from "./scrape/run";
import type { ScrapeSource } from "./scrapers/types";

interface ScheduledTask {
  source: ScrapeSource;
  keyword: string;
}

// 매일 자동 스크래핑 대상. DB(Material 목록) 기반으로 외부화 예정.
const TASKS: ScheduledTask[] = [
  // { source: "kpi", keyword: "폴리카보네이트 복층판" },
];

const SCHEDULE = "0 30 9 * * 1-5"; // 평일 오전 9:30 (cron 6필드)
const TIMEZONE = "Asia/Seoul";

let initialized = false;

export function initScheduler(): void {
  if (initialized) return;
  initialized = true;

  cron.schedule(
    SCHEDULE,
    async () => {
      if (TASKS.length === 0) {
        console.log(
          "[scheduler] 등록된 스크래핑 대상 없음 — TASKS 를 채우거나 DB 기반 동적 로딩으로 전환하세요."
        );
        return;
      }
      for (const { source, keyword } of TASKS) {
        try {
          const result = await runScrape(source, keyword);
          console.log(
            `[scheduler] ${source}/"${keyword}" → run #${result.scrapeRunId} (${result.normalizedCount} normalized rows)`
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[scheduler] ${source}/"${keyword}" 실패: ${message}`
          );
        }
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(
    `[scheduler] cron 등록됨: "${SCHEDULE}" (${TIMEZONE}), ${TASKS.length}개 작업`
  );
}
