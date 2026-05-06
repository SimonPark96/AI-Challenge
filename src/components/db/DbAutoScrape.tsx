"use client";

import { useEffect, useRef, useState } from "react";
import {
  Repeat,
  Play,
  Square,
  Loader2,
  Pencil,
  Plus,
  X,
  Check,
  XCircle,
} from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";

interface CycleResultItem {
  source: string;
  keyword: string;
  ok: boolean;
  scrapeRunId?: number;
  wageRunIds?: number[];
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
  purgedWageRuns?: number;
  rolledBackWageRuns?: number;
  results: CycleResultItem[];
}

interface CycleProgress {
  total: number;
  completed: number;
  current: { source: string; keyword: string } | null;
  startedAt: string;
  results: CycleResultItem[];
  purgedScrapeRuns: number;
  purgedWageRuns: number;
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
  wageCategories?: string[];
}

const POLL_MS_IDLE = 3000;
const POLL_MS_RUNNING = 1500;

const WAGE_CATE_LABELS: Record<string, string> = {
  "701111": "공사부문",
  "701115": "기타직종",
};

export function DbAutoScrape() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [scheduleInput, setScheduleInput] = useState("*/1 * * * *");
  const [busy, setBusy] = useState<"start" | "stop" | null>(null);
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

  async function call(action: "start" | "stop") {
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
    <section
      className={`bg-white rounded-lg border p-6 space-y-4 transition ${
        inProgress
          ? "border-emerald-400 ring-2 ring-emerald-200/60"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Repeat size={18} className="text-emerald-500" />
          자동 스크래핑 (정기 실행)
          <InfoTooltip width="w-96">
            한 사이클에서 자재 단가(3개 사이트 × 5개 키워드 = 15스텝) +
            노임 단가(KPI 두 카테고리, 1스텝) 를 함께 수집합니다. 모든 16개 스텝이
            에러 없이 끝났을 때만 기존 데이터를 교체(swap)하고, 한 스텝이라도
            실패하거나 중도 OFF 하면 이번 사이클 신규 데이터는 모두 롤백되어 기존
            DB(자재·노임 양쪽) 가 유지됩니다. 진행 중 OFF 시 다음 스텝 직전에
            사이클을 중단합니다 (현재 진행 중인 한 스텝은 끝까지 수행).
          </InfoTooltip>
          {inProgress && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              <Loader2 size={12} className="animate-spin" />
              진행 중
              {status?.cycleProgress
                ? ` (${status.cycleProgress.completed}/${status.cycleProgress.total})`
                : ""}
            </span>
          )}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <KeywordsCard
          keywords={status?.keywords ?? []}
          inProgress={inProgress}
          onSaved={(s) => {
            setStatus(s);
          }}
        />
        <div className="border border-slate-200 rounded p-3">
          <div className="text-slate-500 mb-1">자재 사이트 ({status?.sources.length ?? 0}개)</div>
          <div className="flex flex-wrap gap-1">
            {(status?.sources ?? []).map((s) => (
              <span key={s} className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded uppercase">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="border border-slate-200 rounded p-3">
          <div className="text-slate-500 mb-1">
            노임 카테고리 ({status?.wageCategories?.length ?? 0}개)
          </div>
          <div className="flex flex-wrap gap-1">
            {(status?.wageCategories ?? []).map((c) => (
              <span
                key={c}
                className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded"
                title={c}
              >
                {WAGE_CATE_LABELS[c] ?? c}
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
            {status.lastCycle.committed === true && (
              <span>
                교체된 이전 회차: 자재{" "}
                <span className="text-slate-900">
                  {status.lastCycle.purgedScrapeRuns ?? 0}
                </span>{" "}
                / 노임{" "}
                <span className="text-slate-900">
                  {status.lastCycle.purgedWageRuns ?? 0}
                </span>
              </span>
            )}
            {status.lastCycle.committed === false &&
              ((status.lastCycle.rolledBackScrapeRuns ?? 0) > 0 ||
                (status.lastCycle.rolledBackWageRuns ?? 0) > 0) && (
                <span>
                  롤백된 신규 회차: 자재{" "}
                  <span className="text-slate-900">
                    {status.lastCycle.rolledBackScrapeRuns ?? 0}
                  </span>{" "}
                  / 노임{" "}
                  <span className="text-slate-900">
                    {status.lastCycle.rolledBackWageRuns ?? 0}
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

function KeywordsCard({
  keywords,
  inProgress,
  onSaved,
}: {
  keywords: string[];
  inProgress: boolean;
  onSaved: (status: SchedulerStatus) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(keywords);
  const [newKw, setNewKw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    setDraft([...keywords]);
    setNewKw("");
    setErr(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setNewKw("");
    setErr(null);
  }

  function add() {
    const k = newKw.trim();
    if (!k) return;
    const key = k.toLowerCase().replace(/\s+/g, " ");
    if (draft.some((d) => d.toLowerCase().replace(/\s+/g, " ") === key)) {
      setErr("이미 존재하는 키워드입니다.");
      return;
    }
    setDraft((d) => [...d, k]);
    setNewKw("");
    setErr(null);
  }

  function removeAt(idx: number) {
    setDraft((d) => d.filter((_, i) => i !== idx));
  }

  async function save() {
    if (draft.length === 0) {
      setErr("키워드는 최소 1개 이상이어야 합니다.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setKeywords", keywords: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.status) onSaved(data.status);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-slate-500">
          자재 키워드 ({editing ? draft.length : keywords.length}개)
          {editing && (
            <span className="ml-1.5 text-[11px] text-amber-600">
              · 저장 시 다음 사이클부터 적용
            </span>
          )}
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
          >
            <Pencil size={11} /> 편집
          </button>
        ) : (
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
            >
              <Check size={11} /> {saving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              <XCircle size={11} /> 취소
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap gap-1">
          {keywords.length === 0 ? (
            <span className="text-slate-400 text-[11px]">키워드 없음</span>
          ) : (
            keywords.map((k) => (
              <span
                key={k}
                className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded"
              >
                {k}
              </span>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {draft.map((k, i) => (
              <span
                key={`${k}-${i}`}
                className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded"
              >
                {k}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  disabled={saving}
                  className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
                  title="삭제"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {draft.length === 0 && (
              <span className="text-slate-400 text-[11px]">
                키워드를 추가하세요
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <input
              value={newKw}
              onChange={(e) => setNewKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="새 키워드 입력 후 추가"
              disabled={saving}
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs disabled:opacity-50"
            />
            <button
              type="button"
              onClick={add}
              disabled={!newKw.trim() || saving}
              className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50"
            >
              <Plus size={11} /> 추가
            </button>
          </div>
          {inProgress && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              현재 사이클 진행 중 — 변경된 키워드는 다음 사이클부터 적용됩니다.
            </div>
          )}
          {err && (
            <div className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">
              {err}
            </div>
          )}
        </div>
      )}
    </div>
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
