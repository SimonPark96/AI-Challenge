"use client";

import { useEffect, useRef, useState } from "react";
import {
  Wallet,
  Loader2,
  AlertTriangle,
  Sparkles,
  Check,
  Filter,
  X,
} from "lucide-react";
import {
  useRequestStore,
  type SelectedSummary,
} from "@/lib/stores/request-store";

const DEBOUNCE_MS = 800;
const MIN_NAME_LEN = 2;

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() + "원" : "-";
}

function ymd(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Facets {
  businessDivisions: string[];
  contractDateRange: { min: string | null; max: string | null };
}

const EMPTY_FACETS: Facets = {
  businessDivisions: [],
  contractDateRange: { min: null, max: null },
};

export function PriceSummarySelector() {
  const projectName = useRequestStore((s) => s.form.projectName);
  const spec = useRequestStore((s) => s.form.spec);
  const setAutoMatchResult = useRequestStore((s) => s.setAutoMatchResult);

  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);
  const [filterDivision, setFilterDivision] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  // facets 초기 1회 로드
  useEffect(() => {
    let cancelled = false;
    fetch("/api/price-summary/facets")
      .then((res) => res.json())
      .then((data: Facets) => {
        if (cancelled) return;
        setFacets({
          businessDivisions: data.businessDivisions ?? [],
          contractDateRange: data.contractDateRange ?? {
            min: null,
            max: null,
          },
        });
      })
      .catch(() => {
        /* facets 실패해도 매칭은 진행 — 필터만 비활성 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        body: JSON.stringify({
          name,
          spec: sp || undefined,
          businessDivision: filterDivision || undefined,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined,
        }),
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
  }, [projectName, spec, filterDivision, filterDateFrom, filterDateTo]);

  const hasFilter = !!(filterDivision || filterDateFrom || filterDateTo);
  function resetFilters() {
    setFilterDivision("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Wallet size={18} className="text-blue-500" />
          실적 단가 자동 매칭
          <Sparkles size={14} className="text-blue-400" />
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          A 영역의 <b>공사명 + 규격</b> 으로 PriceSummary 에서 유사도 높은 후보
          최대 5개를 자동 매칭합니다. 가장 신뢰도 높은 항목이 기본 선택되며,
          다른 후보를 클릭해 변경할 수 있습니다.
        </p>
      </div>

      <FilterBar
        facets={facets}
        division={filterDivision}
        dateFrom={filterDateFrom}
        dateTo={filterDateTo}
        onDivisionChange={setFilterDivision}
        onDateFromChange={setFilterDateFrom}
        onDateToChange={setFilterDateTo}
        hasFilter={hasFilter}
        onReset={resetFilters}
      />

      <StatusBlock />

      <CandidateList />
    </section>
  );
}

function FilterBar({
  facets,
  division,
  dateFrom,
  dateTo,
  onDivisionChange,
  onDateFromChange,
  onDateToChange,
  hasFilter,
  onReset,
}: {
  facets: Facets;
  division: string;
  dateFrom: string;
  dateTo: string;
  onDivisionChange: (v: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  hasFilter: boolean;
  onReset: () => void;
}) {
  const minDate = facets.contractDateRange.min
    ? facets.contractDateRange.min.slice(0, 10)
    : undefined;
  const maxDate = facets.contractDateRange.max
    ? facets.contractDateRange.max.slice(0, 10)
    : undefined;

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-md border border-slate-200 bg-slate-50/40">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
        <Filter size={12} />
        필터
      </div>
      <label className="flex items-center gap-1.5 text-xs">
        <span className="text-slate-600">본부</span>
        <select
          value={division}
          onChange={(e) => onDivisionChange(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white min-w-[120px]"
        >
          <option value="">전체</option>
          {facets.businessDivisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs">
        <span className="text-slate-600">기간</span>
        <input
          type="date"
          value={dateFrom}
          min={minDate}
          max={maxDate}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
        />
        <span className="text-slate-400">~</span>
        <input
          type="date"
          value={dateTo}
          min={minDate}
          max={maxDate}
          onChange={(e) => onDateToChange(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
        />
      </label>
      {hasFilter && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <X size={12} />
          초기화
        </button>
      )}
    </div>
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
        매칭되는 PriceSummary 후보를 찾지 못했습니다. 필터를 완화하거나 DB
        관리에서 자료를 추가하세요.
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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
  const confTone =
    confPct >= 70
      ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70"
      : confPct >= 40
      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200/70"
      : "bg-rose-100 text-rose-700 ring-1 ring-rose-200/70";

  const periodText =
    candidate.firstContractDate || candidate.lastContractDate
      ? `${ymd(candidate.firstContractDate)} ~ ${ymd(candidate.lastContractDate)}`
      : null;

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
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold tabular-nums ${confTone}`}
          title={candidate.method ? `매칭: ${candidate.method}` : undefined}
        >
          {confPct}%
        </span>
      </div>

      <div
        className="font-semibold text-slate-800 truncate"
        title={candidate.name}
      >
        {candidate.name}
      </div>
      <div className="text-xs text-slate-500 truncate">
        {candidate.spec ?? "-"}
        {candidate.unit ? ` / ${candidate.unit}` : ""}
      </div>

      {(candidate.businessDivision ||
        candidate.projectName ||
        periodText) && (
        <div className="mt-2 space-y-0.5 text-[11px]">
          {candidate.businessDivision && (
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">본부</span>
              <span
                className="text-slate-600 truncate"
                title={candidate.businessDivision}
              >
                {candidate.businessDivision}
              </span>
            </div>
          )}
          {candidate.projectName && (
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">프로젝트</span>
              <span
                className="text-slate-600 truncate"
                title={candidate.projectName}
              >
                {candidate.projectName}
              </span>
            </div>
          )}
          {periodText && (
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">기간</span>
              <span className="text-slate-600 font-mono">{periodText}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs">
        <Row label="합계" value={fmt(candidate.totalCost)} bold />
        <Row label="재료비" value={fmt(candidate.materialCost)} />
        <Row label="노무비" value={fmt(candidate.laborCost)} />
        <Row label="경비" value={fmt(candidate.expenseCost)} />
      </div>

      {candidate.sourceFile && (
        <div
          className="text-[11px] text-slate-400 mt-2 truncate"
          title={candidate.sourceFile}
        >
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
        className={`font-mono ${
          bold ? "font-semibold text-slate-800" : "text-slate-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
