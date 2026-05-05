"use client";

import { useEffect, useRef } from "react";
import { Wallet, Loader2, AlertTriangle, Sparkles, Check } from "lucide-react";
import {
  useRequestStore,
  type SelectedSummary,
} from "@/lib/stores/request-store";

const DEBOUNCE_MS = 800;
const MIN_NAME_LEN = 2;

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() + "원" : "-";
}

export function PriceSummarySelector() {
  const projectName = useRequestStore((s) => s.form.projectName);
  const spec = useRequestStore((s) => s.form.spec);
  const setAutoMatchResult = useRequestStore((s) => s.setAutoMatchResult);

  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const name = projectName.trim();
    const sp = spec.trim();

    if (name.length < MIN_NAME_LEN) {
      abortRef.current?.abort();
      setAutoMatchResult({
        status: "idle",
        candidates: [],
        error: null,
      });
      return;
    }

    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const myId = ++reqIdRef.current;

      setAutoMatchResult({
        status: "loading",
        candidates: [],
        error: null,
      });

      fetch("/api/price-summary/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, spec: sp || undefined }),
        signal: ac.signal,
      })
        .then(async (res) => {
          if (myId !== reqIdRef.current) return;
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
          const data = (await res.json()) as {
            candidates: SelectedSummary[];
          };
          if (myId !== reqIdRef.current) return;
          const candidates = data.candidates ?? [];
          setAutoMatchResult({
            status: candidates.length > 0 ? "matched" : "empty",
            candidates,
            error: null,
          });
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          if (myId !== reqIdRef.current) return;
          setAutoMatchResult({
            status: "error",
            candidates: [],
            error: err.message,
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, spec]);

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Wallet size={18} className="text-blue-500" />
          단가 합계 자동 매칭
          <Sparkles size={14} className="text-blue-400" />
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          A 영역의 <b>공사명 + 규격</b> 으로 PriceSummary 에서 유사도 높은 후보
          최대 3개를 자동 매칭합니다. 가장 신뢰도 높은 항목이 기본 선택되며,
          다른 후보를 클릭해 변경할 수 있습니다.
        </p>
      </div>

      <StatusBlock />

      <CandidateList />
    </section>
  );
}

function StatusBlock() {
  const status = useRequestStore((s) => s.autoMatch.status);
  const error = useRequestStore((s) => s.autoMatch.error);

  if (status === "idle") {
    return (
      <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded p-3">
        공사명을 입력하면 자동으로 매칭이 시작됩니다.
      </div>
    );
  }
  if (status === "loading") {
    return (
      <div className="text-xs text-blue-600 border border-blue-200 bg-blue-50/40 rounded p-3 inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        매칭 후보 검색 중...
      </div>
    );
  }
  if (status === "empty") {
    return (
      <div className="text-xs text-slate-500 border border-slate-200 bg-slate-50 rounded p-3 inline-flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-500" />
        매칭되는 PriceSummary 후보를 찾지 못했습니다. DB 관리에서 자료를
        추가하거나 입력값을 조정해 주세요.
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded p-3 inline-flex items-center gap-2">
        <AlertTriangle size={14} />
        매칭 실패: {error}
      </div>
    );
  }
  return null;
}

function CandidateList() {
  const candidates = useRequestStore((s) => s.autoMatch.candidates);
  const selectedId = useRequestStore((s) => s.selectedSummary?.id ?? null);
  const setSelected = useRequestStore((s) => s.setSelectedSummary);

  if (candidates.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {candidates.map((c, idx) => (
        <CandidateCard
          key={c.id}
          rank={idx + 1}
          candidate={c}
          selected={selectedId === c.id}
          onClick={() => setSelected(c)}
        />
      ))}
    </div>
  );
}

function CandidateCard({
  rank,
  candidate,
  selected,
  onClick,
}: {
  rank: number;
  candidate: SelectedSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const conf = candidate.confidence ?? 0;
  const confPct = Math.round(conf * 100);
  const confColor =
    confPct >= 70
      ? "text-emerald-600"
      : confPct >= 40
        ? "text-amber-600"
        : "text-rose-600";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-4 transition cursor-pointer ${
        selected
          ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-200"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {selected ? (
            <span className="inline-flex items-center gap-1 text-blue-700">
              <Check size={12} />
              선택됨
            </span>
          ) : (
            <span className="text-slate-500">후보 #{rank}</span>
          )}
        </div>
        <span className="text-[11px] text-slate-500">
          신뢰도 <span className={`font-mono ${confColor}`}>{confPct}%</span>
          {candidate.method ? ` · ${candidate.method}` : ""}
        </span>
      </div>

      <div className="font-semibold text-slate-800 truncate" title={candidate.name}>
        {candidate.name}
      </div>
      <div className="text-xs text-slate-500 truncate">
        {candidate.spec ?? "-"}
        {candidate.unit ? ` / ${candidate.unit}` : ""}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs">
        <Row label="합계" value={fmt(candidate.totalCost)} bold />
        <Row label="재료비" value={fmt(candidate.materialCost)} />
        <Row label="노무비" value={fmt(candidate.laborCost)} />
        <Row label="경비" value={fmt(candidate.expenseCost)} />
      </div>

      {candidate.sourceFile && (
        <div className="text-[11px] text-slate-400 mt-2 truncate" title={candidate.sourceFile}>
          출처: {candidate.sourceFile}
          {candidate.sourceVia ? ` (${candidate.sourceVia})` : ""}
        </div>
      )}
    </button>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-mono ${bold ? "font-semibold text-slate-800" : "text-slate-700"}`}
      >
        {value}
      </span>
    </div>
  );
}
