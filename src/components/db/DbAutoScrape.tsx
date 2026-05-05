"use client";

import { useEffect, useRef, useState } from "react";
import { Repeat, Play, Square, RefreshCw } from "lucide-react";

interface CycleResultItem {
  source: string;
  keyword: string;
  ok: boolean;
  scrapeRunId?: number;
  normalizedCount?: number;
  error?: string;
}

interface CycleSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: number;
  failed: number;
  cancelled?: boolean;
  committed?: boolean;
  purgedScrapeRuns?: number;
  rolledBackScrapeRuns?: number;
  results: CycleResultItem[];
}

interface CycleProgress {
  total: number;
  completed: number;
  current: { source: string; keyword: string } | null;
  startedAt: string;
  results: CycleResultItem[];
  purgedScrapeRuns: number;
}

interface SchedulerStatus {
  enabled: boolean;
  schedule: string;
  timezone: string;
  cycleInProgress: boolean;
  cycleProgress: CycleProgress | null;
  startedAt: string | null;
  totalCycles: number;
  skippedCycles: number;
  lastCycle: CycleSummary | null;
  keywords: string[];
  sources: string[];
}

const POLL_MS_IDLE = 3000;
const POLL_MS_RUNNING = 1500;

export function DbAutoScrape() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [scheduleInput, setScheduleInput] = useState("*/1 * * * *");
  const [busy, setBusy] = useState<"start" | "stop" | "runNow" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editedRef = useRef(false);

  // setTimeout 체이닝으로 폴링 — 매 tick 결과의 cycleInProgress 로 다음 간격을 결정.
  // setInterval + 상태 의존 deps 조합은 cascading render 경고를 유발하므로 피한다.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      let inProgress = false;
      try {
        const res = await fetch("/api/scheduler", { cache: "no-store" });
        const data: SchedulerStatus = await res.json();
        if (cancelled) return;
        setStatus(data);
        if (!editedRef.current) setScheduleInput(data.schedule);
        inProgress = data.cycleInProgress === true;
      } catch (err) {
        if (cancelled) return;
        setError(String(err));
      }
      if (cancelled) return;
      timer = setTimeout(tick, inProgress ? POLL_MS_RUNNING : POLL_MS_IDLE);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function call(action: "start" | "stop" | "runNow") {
    setBusy(action);
    setError(null);
    try {
      const body: Record<string, string> = { action };
      if (action === "start") body.schedule = scheduleInput.trim();
      const res = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else if (data.status) {
        setStatus(data.status);
        editedRef.current = false;
        setScheduleInput(data.status.schedule);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  const enabled = status?.enabled === true;
  const inProgress = status?.cycleInProgress === true;

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Repeat size={18} className="text-emerald-500" /> 자동 스크래핑 (정기 실행)
        </h2>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs text-slate-500">{enabled ? "ON" : "OFF"}</span>
          <span className="relative">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              disabled={busy !== null}
              onChange={() => call(enabled ? "stop" : "start")}
            />
            <span className="block w-11 h-6 bg-slate-300 rounded-full peer-checked:bg-emerald-500 transition" />
            <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition peer-checked:translate-x-5" />
          </span>
        </label>
      </div>

      <p className="text-xs text-slate-500">
        고정 키워드 셋을 3개 사이트(KPI/KPRC/CMPI) 모두에서 검색해 PriceHistory + 임베딩까지 자동 생성합니다.
        <span className="text-emerald-700"> 모든 항목이 에러 없이 끝났을 때만 기존 데이터와 교체</span>(swap)되고, 한 항목이라도 실패하거나 중도 OFF 하면 이번 사이클 신규 데이터는 롤백되어 기존 DB 가 유지됩니다.
        {" "}진행 중에 OFF 하면 다음 항목 직전에 사이클을 중단합니다 (현재 진행 중인 한 항목은 끝까지 수행).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="border border-slate-200 rounded p-3">
          <div className="text-slate-500 mb-1">키워드 ({status?.keywords.length ?? 0}개)</div>
          <div className="flex flex-wrap gap-1">
            {(status?.keywords ?? []).map((k) => (
              <span key={k} className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="border border-slate-200 rounded p-3">
          <div className="text-slate-500 mb-1">사이트 ({status?.sources.length ?? 0}개)</div>
          <div className="flex flex-wrap gap-1">
            {(status?.sources ?? []).map((s) => (
              <span key={s} className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded uppercase">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-slate-600">
          <span className="mb-1">cron 식 (5필드: 분 시 일 월 요일)</span>
          <input
            value={scheduleInput}
            onChange={(e) => {
              editedRef.current = true;
              setScheduleInput(e.target.value);
            }}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm font-mono min-w-[200px]"
            placeholder="*/1 * * * *"
          />
        </label>
        <button
          onClick={() => call("start")}
          disabled={busy !== null}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm inline-flex items-center gap-1 disabled:opacity-50"
          title={enabled ? "현재 스케줄 재시작 (cron 식 적용)" : "스케줄러 시작"}
        >
          <Play size={14} />
          {enabled ? "재시작 (적용)" : "시작"}
        </button>
        <button
          onClick={() => call("stop")}
          disabled={busy !== null || !enabled}
          className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Square size={14} /> 정지
        </button>
        <button
          onClick={() => call("runNow")}
          disabled={busy !== null || inProgress}
          className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm inline-flex items-center gap-1 disabled:opacity-50"
          title="즉시 1회 실행 (사이클 진행 중이면 무시)"
        >
          <RefreshCw size={14} className={inProgress ? "animate-spin" : ""} />
          즉시 실행
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Stat label="상태" value={enabled ? "실행 중" : "정지"} highlight={enabled} />
        <Stat label="사이클 진행" value={inProgress ? "예" : "—"} highlight={inProgress} />
        <Stat label="총 사이클" value={String(status?.totalCycles ?? 0)} />
        <Stat label="스킵 사이클" value={String(status?.skippedCycles ?? 0)} />
      </div>

      {status?.cycleProgress && (
        <CycleProgressCard progress={status.cycleProgress} />
      )}

      {status?.lastCycle && (
        <div className="border border-slate-200 rounded p-3 text-xs space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
            <span>
              마지막 사이클:{" "}
              <span className="text-slate-900">
                {new Date(status.lastCycle.startedAt).toLocaleString("ko-KR")}
              </span>
              {status.lastCycle.cancelled ? (
                <span className="ml-2 text-rose-700 font-semibold">(중단·롤백)</span>
              ) : status.lastCycle.committed === true ? (
                <span className="ml-2 text-emerald-700 font-semibold">(commit)</span>
              ) : status.lastCycle.committed === false ? (
                <span className="ml-2 text-rose-700 font-semibold">(rollback)</span>
              ) : null}
            </span>
            <span>
              소요: <span className="text-slate-900">{(status.lastCycle.durationMs / 1000).toFixed(1)}s</span>
            </span>
            <span>
              성공: <span className="text-emerald-700">{status.lastCycle.ok}</span> / 실패:{" "}
              <span className="text-rose-700">{status.lastCycle.failed}</span>
            </span>
            {status.lastCycle.committed === true &&
              typeof status.lastCycle.purgedScrapeRuns === "number" && (
                <span>
                  교체된 이전 run:{" "}
                  <span className="text-slate-900">
                    {status.lastCycle.purgedScrapeRuns}
                  </span>
                </span>
              )}
            {status.lastCycle.committed === false &&
              typeof status.lastCycle.rolledBackScrapeRuns === "number" &&
              status.lastCycle.rolledBackScrapeRuns > 0 && (
                <span>
                  롤백된 신규 run:{" "}
                  <span className="text-slate-900">
                    {status.lastCycle.rolledBackScrapeRuns}
                  </span>
                </span>
              )}
          </div>
          <details>
            <summary className="cursor-pointer text-slate-500">상세 결과 ({status.lastCycle.results.length}건)</summary>
            <pre className="mt-2 bg-slate-50 border border-slate-200 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(status.lastCycle.results, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="border border-slate-200 rounded p-2">
      <div className="text-slate-500">{label}</div>
      <div className={`font-semibold ${highlight ? "text-emerald-700" : "text-slate-800"}`}>
        {value}
      </div>
    </div>
  );
}

function CycleProgressCard({ progress }: { progress: CycleProgress }) {
  const { total, completed, current, results, startedAt } = progress;
  // 경과 초 라이브 갱신 — Date.now() 는 render 밖(initializer / interval)에서만 호출.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const elapsedSec = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000)
  );
  const recent = results.slice(-5).reverse();

  return (
    <div className="border border-emerald-300 bg-emerald-50/50 rounded p-3 text-xs space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span className="font-semibold text-emerald-800">
          사이클 진행 중 (성공 시에만 swap)
        </span>
        <span className="text-slate-700">
          진행: <span className="font-mono text-slate-900">{completed}/{total}</span> ({percent}%)
        </span>
        <span className="text-slate-700">
          경과: <span className="font-mono text-slate-900">{elapsedSec}s</span>
        </span>
        <span className="text-slate-700">
          성공: <span className="text-emerald-700">{okCount}</span> / 실패:{" "}
          <span className="text-rose-700">{failCount}</span>
        </span>
      </div>

      <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="text-slate-700">
        현재 작업:{" "}
        {current ? (
          <span className="font-mono text-slate-900">
            <span className="uppercase">{current.source}</span> / “{current.keyword}”
          </span>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </div>

      {recent.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-slate-500">최근 결과 ({recent.length}건)</div>
          <ul className="font-mono">
            {recent.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span
                  className={`w-3 inline-block ${
                    r.ok ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {r.ok ? "✓" : "✗"}
                </span>
                <span className="uppercase text-slate-600 w-10">{r.source}</span>
                <span className="text-slate-800 flex-1 truncate">
                  {r.keyword}
                </span>
                <span className="text-slate-500">
                  {r.ok
                    ? `${r.normalizedCount ?? 0}건`
                    : (r.error ?? "").slice(0, 60)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
