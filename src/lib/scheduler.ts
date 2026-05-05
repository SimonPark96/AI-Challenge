import cron, { type ScheduledTask } from "node-cron";
import { runScrape, type RunScrapeResult } from "./scrape/run";
import { scrapeAndInsertWages, WAGE_CATE_CDS } from "./scrape/run-wage";
import type { ScrapeSource } from "./scrapers/types";
import { prisma } from "./prisma";

// 자동 스크래핑 대상 — 키워드와 소스. 손쉬운 수정 위해 모듈 상단 상수로 둠.
export const AUTO_KEYWORDS: readonly string[] = ["폴리카보네이트 복층판", "AL 몰드", "AL 시트", "이형철근", "강판"];

export const AUTO_SOURCES: readonly ScrapeSource[] = ["kpi", "kprc", "cmpi"];

// 기본 cron 식 — 1분마다 (테스트용). UI 에서 자유롭게 변경 가능.
export const DEFAULT_SCHEDULE = "*/1 * * * *";
export const TIMEZONE = "Asia/Seoul";

// 한 사이클 내 한 스텝의 결과. material 스텝은 source = "kpi"|"kprc"|"cmpi",
// 노임단가 스텝은 source = "kpi-wage", keyword = "노임단가" 로 통일.
export interface CycleResultItem {
  source: string;
  keyword: string;
  ok: boolean;
  scrapeRunId?: number; // material 의 ScrapeRun.id
  wageRunIds?: number[]; // 노임단가 사이클의 신규 WageRun.id 들
  normalizedCount?: number; // material: 정규화 행 수, wage: 전체 행 수
  error?: string;
}

interface CycleSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: number;
  failed: number;
  cancelled: boolean;
  /**
   * commit=true:  모든 스텝 성공 + 취소 안됨 → 이전 ScrapeRun/WageRun 삭제, 신규 적용 (swap)
   * commit=false: 일부 실패 또는 취소됨 → 이번 사이클의 신규 데이터 롤백, 기존 데이터 유지
   */
  committed: boolean;
  purgedScrapeRuns: number; // commit 시 swap 으로 사라진 이전 자재 ScrapeRun 수
  rolledBackScrapeRuns: number; // rollback 시 지워진 이번 사이클 자재 ScrapeRun 수
  purgedWageRuns: number; // commit 시 swap 으로 사라진 이전 노임 WageRun 수
  rolledBackWageRuns: number; // rollback 시 지워진 이번 사이클 노임 WageRun 수
  results: CycleResultItem[];
}

export interface CycleProgress {
  total: number;
  completed: number;
  current: { source: string; keyword: string } | null;
  startedAt: string;
  results: CycleResultItem[];
  purgedScrapeRuns: number;
  purgedWageRuns: number;
}

interface SchedulerState {
  task: ScheduledTask | null;
  schedule: string;
  enabled: boolean;
  cycleInProgress: boolean;
  cycleProgress: CycleProgress | null;
  cancelRequested: boolean; // OFF 클릭 시 in-flight 사이클을 다음 iteration 에서 중단시키기 위한 플래그
  lastCycle: CycleSummary | null;
  startedAt: string | null;
  totalCycles: number;
  skippedCycles: number; // 직전 사이클이 끝나지 않아 스킵된 횟수
}

// HMR 회피: dev 모드에서 module reload 가 일어나도 cron task / state 가 유실되지 않도록
// globalThis 에 보존. (prisma.ts 의 패턴과 동일)
const globalForScheduler = globalThis as unknown as {
  __schedulerState?: SchedulerState;
};

const state: SchedulerState = globalForScheduler.__schedulerState ?? {
  task: null,
  schedule: DEFAULT_SCHEDULE,
  enabled: false,
  cycleInProgress: false,
  cycleProgress: null,
  cancelRequested: false,
  lastCycle: null,
  startedAt: null,
  totalCycles: 0,
  skippedCycles: 0,
};

if (process.env.NODE_ENV !== "production") {
  globalForScheduler.__schedulerState = state;
}

async function runCycle(trigger: "cron" | "manual"): Promise<CycleSummary | null> {
  if (state.cycleInProgress) {
    state.skippedCycles += 1;
    console.log(`[scheduler] 이전 사이클 진행 중 — 스킵 (총 스킵 ${state.skippedCycles}회, trigger=${trigger})`);
    return null;
  }
  state.cycleInProgress = true;
  state.cancelRequested = false;
  state.totalCycles += 1;
  const startedAt = new Date();
  const results: CycleSummary["results"] = [];
  const newScrapeRunIds: number[] = []; // 이번 사이클에서 만들어진 자재 ScrapeRun id
  const newWageRunIds: number[] = []; // 이번 사이클에서 만들어진 노임 WageRun id
  let purgedScrapeRuns = 0;
  let rolledBackScrapeRuns = 0;
  let purgedWageRuns = 0;
  let rolledBackWageRuns = 0;
  let cancelled = false;
  let committed = false;
  // 사이클 step 수 = 자재 (sources × keywords) + 노임 1
  const expectedTotal = AUTO_SOURCES.length * AUTO_KEYWORDS.length + 1;
  state.cycleProgress = {
    total: expectedTotal,
    completed: 0,
    current: null,
    startedAt: startedAt.toISOString(),
    results,
    purgedScrapeRuns: 0,
    purgedWageRuns: 0,
  };

  try {
    // 사이클 시작 시점에는 기존 데이터 그대로 둔다.
    // 모든 항목 성공 + 취소 안됨일 때만 마지막에 swap.
    console.log(`[scheduler] 사이클 시작 — 기존 데이터 보존, 신규 ScrapeRun 누적 후 성공 시에만 swap`);

    outer: for (const source of AUTO_SOURCES) {
      for (const keyword of AUTO_KEYWORDS) {
        if (state.cancelRequested) {
          cancelled = true;
          console.log(
            `[scheduler] 취소 요청 감지 — 사이클 중단 (완료 ${results.length}/${expectedTotal})`
          );
          break outer;
        }
        if (state.cycleProgress) state.cycleProgress.current = { source, keyword };
        try {
          const r: RunScrapeResult = await runScrape(source, keyword);
          results.push({
            source,
            keyword,
            ok: true,
            scrapeRunId: r.scrapeRunId,
            normalizedCount: r.normalizedCount,
          });
          newScrapeRunIds.push(r.scrapeRunId);
          console.log(`[scheduler] ${source}/"${keyword}" → run #${r.scrapeRunId} (${r.normalizedCount} rows)`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ source, keyword, ok: false, error: message });
          console.error(`[scheduler] ${source}/"${keyword}" 실패: ${message}`);
        }
        if (state.cycleProgress) state.cycleProgress.completed += 1;
      }
    }

    // 노임단가 스텝 — 자재 루프가 cancel 로 빠져나오지 않은 경우에만 시도.
    if (!cancelled) {
      if (state.cancelRequested) {
        cancelled = true;
        console.log(`[scheduler] 노임단가 시작 직전 취소 요청 — 스킵`);
      } else {
        if (state.cycleProgress)
          state.cycleProgress.current = { source: "kpi-wage", keyword: "노임단가" };
        try {
          const w = await scrapeAndInsertWages({
            log: (m) => console.log(`  ${m}`),
          });
          newWageRunIds.push(...w.newWageRunIds);
          if (w.allHaveRows && w.newWageRunIds.length === WAGE_CATE_CDS.length) {
            results.push({
              source: "kpi-wage",
              keyword: "노임단가",
              ok: true,
              wageRunIds: w.newWageRunIds,
              normalizedCount: w.totalRows,
            });
            console.log(
              `[scheduler] 노임단가 → ${w.newWageRunIds.length}개 WageRun (${w.totalRows} rows)`
            );
          } else {
            results.push({
              source: "kpi-wage",
              keyword: "노임단가",
              ok: false,
              wageRunIds: w.newWageRunIds,
              error: `카테고리 ${w.newWageRunIds.length}/${WAGE_CATE_CDS.length} 만 적재됨 (allHaveRows=${w.allHaveRows})`,
            });
            console.error(
              `[scheduler] 노임단가 부분 실패: ${w.newWageRunIds.length}/${WAGE_CATE_CDS.length}`
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            source: "kpi-wage",
            keyword: "노임단가",
            ok: false,
            error: message,
          });
          console.error(`[scheduler] 노임단가 throw: ${message}`);
        }
        if (state.cycleProgress) state.cycleProgress.completed += 1;
      }
    }

    // 모든 스텝 성공 + 취소 안됨 → swap (자재 + 노임 동시). 그 외는 rollback (양쪽).
    const allOk = results.length > 0 && results.every((r) => r.ok);
    const fullCycle = results.length === expectedTotal;
    if (!cancelled && allOk && fullCycle) {
      const [swapMat, swapWage] = await Promise.all([
        prisma.scrapeRun.deleteMany({
          where: { id: { notIn: newScrapeRunIds } },
        }),
        prisma.wageRun.deleteMany({
          where: { id: { notIn: newWageRunIds } },
        }),
      ]);
      purgedScrapeRuns = swapMat.count;
      purgedWageRuns = swapWage.count;
      committed = true;
      if (state.cycleProgress) {
        state.cycleProgress.purgedScrapeRuns = purgedScrapeRuns;
        state.cycleProgress.purgedWageRuns = purgedWageRuns;
      }
      console.log(
        `[scheduler] 전체 성공 → swap: 이전 ScrapeRun ${purgedScrapeRuns} + WageRun ${purgedWageRuns} 삭제 (commit)`
      );
    } else if (newScrapeRunIds.length > 0 || newWageRunIds.length > 0) {
      // rollback: 이번 사이클 신규 데이터(자재 + 노임) 모두 삭제. 기존 데이터 유지.
      const [rbMat, rbWage] = await Promise.all([
        newScrapeRunIds.length > 0
          ? prisma.scrapeRun.deleteMany({ where: { id: { in: newScrapeRunIds } } })
          : Promise.resolve({ count: 0 }),
        newWageRunIds.length > 0
          ? prisma.wageRun.deleteMany({ where: { id: { in: newWageRunIds } } })
          : Promise.resolve({ count: 0 }),
      ]);
      rolledBackScrapeRuns = rbMat.count;
      rolledBackWageRuns = rbWage.count;
      console.log(
        `[scheduler] ${
          cancelled ? "중단" : "일부 실패"
        } → rollback: 신규 ScrapeRun ${rolledBackScrapeRuns} + WageRun ${rolledBackWageRuns} 삭제 (기존 데이터 유지)`
      );
    } else {
      console.log(
        `[scheduler] ${cancelled ? "중단" : "전체 실패"} — 신규 데이터 없음, 기존 데이터 유지`
      );
    }
  } finally {
    const finishedAt = new Date();
    const summary: CycleSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      cancelled,
      committed,
      purgedScrapeRuns,
      rolledBackScrapeRuns,
      purgedWageRuns,
      rolledBackWageRuns,
      results,
    };
    state.lastCycle = summary;
    state.cycleInProgress = false;
    state.cycleProgress = null;
    state.cancelRequested = false;
    const stateLabel = cancelled ? "중단(rollback)" : committed ? "완료(commit)" : "실패(rollback)";
    console.log(
      `[scheduler] 사이클 ${stateLabel} (trigger=${trigger}): ok=${summary.ok}, failed=${summary.failed}, ${summary.durationMs}ms`
    );
    return summary;
  }
}

export function startScheduler(schedule: string = state.schedule): {
  ok: true;
  schedule: string;
} {
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: ${schedule}`);
  }
  if (state.task) {
    state.task.destroy();
    state.task = null;
  }
  state.schedule = schedule;
  state.task = cron.schedule(
    schedule,
    () => {
      void runCycle("cron");
    },
    { timezone: TIMEZONE }
  );
  state.enabled = true;
  state.startedAt = new Date().toISOString();
  // stop 직후 다시 start 한 경우 — 직전 사이클의 cancel 신호가 남아있을 수 있어 해제.
  state.cancelRequested = false;
  console.log(`[scheduler] 시작: "${schedule}" (${TIMEZONE})`);
  return { ok: true, schedule };
}

export function stopScheduler(): { ok: true; cancelledInflight: boolean } {
  if (state.task) {
    state.task.destroy();
    state.task = null;
  }
  state.enabled = false;
  state.startedAt = null;
  // 진행 중인 사이클이 있으면 다음 (source, keyword) 직전에 중단되도록 신호.
  const cancelledInflight = state.cycleInProgress;
  if (cancelledInflight) state.cancelRequested = true;
  console.log(`[scheduler] 정지 — in-flight 사이클 ${cancelledInflight ? "중단 요청" : "없음"}`);
  return { ok: true, cancelledInflight };
}

export async function runCycleNow(): Promise<CycleSummary | null> {
  return runCycle("manual");
}

export interface SchedulerStatus {
  enabled: boolean;
  schedule: string;
  timezone: string;
  cycleInProgress: boolean;
  cycleProgress: CycleProgress | null;
  startedAt: string | null;
  totalCycles: number;
  skippedCycles: number;
  lastCycle: CycleSummary | null;
  keywords: readonly string[];
  sources: readonly ScrapeSource[];
  wageCategories: readonly string[]; // KPI 노임단가 CATE_CD 들
}

export function getSchedulerStatus(): SchedulerStatus {
  return {
    enabled: state.enabled,
    schedule: state.schedule,
    timezone: TIMEZONE,
    cycleInProgress: state.cycleInProgress,
    cycleProgress: state.cycleProgress,
    startedAt: state.startedAt,
    totalCycles: state.totalCycles,
    skippedCycles: state.skippedCycles,
    lastCycle: state.lastCycle,
    keywords: AUTO_KEYWORDS,
    sources: AUTO_SOURCES,
    wageCategories: WAGE_CATE_CDS,
  };
}

// instrumentation.ts 호환 — SCHEDULER_ENABLED=true 일 때 부팅 시 자동 시작.
export function initScheduler(): void {
  if (state.enabled) return;
  startScheduler();
}
