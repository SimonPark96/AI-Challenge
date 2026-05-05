import { NextResponse } from "next/server";
import {
  getSchedulerStatus,
  runCycleNow,
  startScheduler,
  stopScheduler,
} from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSchedulerStatus());
}

type Action = "start" | "stop" | "runNow";

export async function POST(req: Request) {
  let body: { action?: unknown; schedule?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { action: 'start'|'stop'|'runNow', schedule?: string }" },
      { status: 400 }
    );
  }

  const action = body.action as Action | undefined;
  if (action !== "start" && action !== "stop" && action !== "runNow") {
    return NextResponse.json(
      { error: "action must be one of: start, stop, runNow" },
      { status: 400 }
    );
  }

  try {
    if (action === "start") {
      const schedule =
        typeof body.schedule === "string" && body.schedule.trim()
          ? body.schedule.trim()
          : undefined;
      const r = schedule ? startScheduler(schedule) : startScheduler();
      return NextResponse.json({ ...r, status: getSchedulerStatus() });
    }
    if (action === "stop") {
      const r = stopScheduler();
      return NextResponse.json({ ...r, status: getSchedulerStatus() });
    }
    // runNow — 비동기. 수동 실행은 cycleInProgress 가드를 그대로 따름.
    void runCycleNow();
    return NextResponse.json({ ok: true, status: getSchedulerStatus() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
