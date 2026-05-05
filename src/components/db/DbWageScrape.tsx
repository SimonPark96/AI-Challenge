"use client";

import { useState } from "react";
import { HardHat, DownloadCloud } from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";

interface ScrapeRunResult {
  source: string;
  fetchedAt: string;
  totalRows: number;
  committed: boolean;
  purgedWageRuns: number;
  rolledBackWageRuns: number;
  categories: Array<{
    cateCd: string;
    sourceUrl: string;
    wageRunId: number;
    rowCount: number;
  }>;
}

const CATE_LABELS: Record<string, string> = {
  "701111": "공사부문 (CATE_CD=701111)",
  "701115": "기타직종 (CATE_CD=701115)",
};

export function DbWageScrape() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScrapeRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runScrape() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scrape/wage", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setResult(data as ScrapeRunResult);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
        <HardHat size={18} className="text-amber-500" /> 노임 단가 스크래핑 (KPI)
        <InfoTooltip>
          KPI 의 노임단가 페이지 두 카테고리(공사부문 / 기타직종) 에서 직종별
          일당을 가져와 노임 단가 DB 에 저장합니다. 모든 카테고리에서 1행 이상
          추출됐을 때만 기존 데이터와 교체(swap), 그 외에는 롤백(rollback) 되어
          기존 데이터가 유지됩니다.
        </InfoTooltip>
      </h3>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={runScrape}
          disabled={running}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded text-sm inline-flex items-center gap-1 disabled:opacity-50"
        >
          <DownloadCloud size={14} />
          {running ? "스크래핑 중... (수십 초)" : "스크래핑"}
        </button>
        {result && (
          <span className="text-xs text-slate-700">
            결과: 총 <span className="font-mono text-slate-900">{result.totalRows}</span>건
            {result.committed ? (
              <span className="ml-2 text-emerald-700 font-semibold">commit</span>
            ) : (
              <span className="ml-2 text-rose-700 font-semibold">rollback</span>
            )}
            {result.committed && (
              <span className="ml-2 text-slate-500">
                (이전 {result.purgedWageRuns} 회차 교체)
              </span>
            )}
          </span>
        )}
      </div>

      {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">{error}</div>}

      {result && result.categories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {result.categories.map((c) => (
            <div key={c.cateCd} className="border border-slate-200 rounded p-2 bg-slate-50/60">
              <div className="text-slate-700 font-semibold">{CATE_LABELS[c.cateCd] ?? c.cateCd}</div>
              <div className="text-slate-500">
                run #{c.wageRunId} · {c.rowCount}건
              </div>
            </div>
          ))}
        </div>
      )}

      {result && <p className="text-xs text-slate-500">“조회” 탭으로 이동하면 새로 적재된 데이터가 표시됩니다.</p>}
    </section>
  );
}
