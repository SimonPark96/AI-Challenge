// Next.js instrumentation: 서버 부팅 시 1회 실행됨.
// 스케줄러는 SCHEDULER_ENABLED=true 일 때만 등록 (기본 OFF).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SCHEDULER_ENABLED !== "true") {
    console.log(
      "[scheduler] SCHEDULER_ENABLED 미설정 — cron 등록 스킵"
    );
    return;
  }
  const { initScheduler } = await import("./lib/scheduler");
  initScheduler();
}
