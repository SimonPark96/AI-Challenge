"use client";

import { useState } from "react";
import { Sparkles, Globe } from "lucide-react";

type Source = "kpi" | "kprc" | "cmpi";

const SOURCE_LABELS: Record<Source, string> = {
  kpi: "한국물가정보 (kpi.or.kr)",
  kprc: "한국물가협회 (kprc.or.kr)",
  cmpi: "대한건설협회 (cmpi.or.kr)",
};

export function DbScrape() {
  const [source, setSource] = useState<Source>("cmpi");
  const [keyword, setKeyword] = useState("폴리카보네이트 복층판");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/scrape/${source}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      setResult({ status: res.status, ...data });
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
        <Globe size={18} className="text-blue-500" /> 외부 사이트 스크래핑
      </h2>
      <p className="text-xs text-slate-500">
        선택한 사이트에서 검색어로 단가를 가져와 PriceHistory + 임베딩까지 자동 생성. 30초~수분 소요.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm min-w-[220px] bg-white text-slate-900"
        >
          {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="검색어"
          className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[200px] bg-white text-slate-900 placeholder:text-slate-400"
        />
        <button
          onClick={run}
          disabled={running || !keyword.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Sparkles size={14} />
          {running ? "실행 중..." : "스크래핑"}
        </button>
      </div>

      {result !== null && (
        <pre className="bg-slate-50 border border-slate-200 p-3 rounded text-xs overflow-auto max-h-48">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
  );
}
