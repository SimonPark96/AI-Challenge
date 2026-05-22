"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

function ymd(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface WageRow {
  id: number;
  cateCd: string;
  jobName: string;
  price: number | null;
  unit: string | null;
  basis: string | null;
  description: string | null;
  fetchedAt: string;
}

interface RecentRun {
  id: number;
  cateCd: string;
  sourceUrl: string | null;
  fetchedAt: string;
  _count: { wages: number };
}

export function DbWageList() {
  const [filterCate, setFilterCate] = useState<string>("");
  const [filterJob, setFilterJob] = useState("");
  const [wages, setWages] = useState<WageRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "10000" });
      if (filterCate) params.set("cateCd", filterCate);
      if (filterJob.trim()) params.set("jobName", filterJob.trim());
      const res = await fetch(`/api/wages?${params.toString()}`);
      const data = await res.json();
      setWages(data.wages ?? []);
      setCount(data.count ?? 0);
      setRecentRuns(data.recentRuns ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterCate, filterJob]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
        <Search size={18} className="text-amber-500" /> 노임단가 조회
      </h3>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterCate}
          onChange={(e) => setFilterCate(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900"
        >
          <option value="">전체 카테고리</option>
          <option value="701111">공사부문 (701111)</option>
          <option value="701115">기타직종 (701115)</option>
        </select>
        <input
          value={filterJob}
          onChange={(e) => setFilterJob(e.target.value)}
          placeholder="직종 (부분일치)"
          className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[180px] bg-white text-slate-900 placeholder:text-slate-400"
          onKeyDown={(e) => e.key === "Enter" && refresh()}
        />
        <button
          onClick={refresh}
          disabled={loading}
          className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {loading ? "..." : "조회"}
        </button>
        {count !== null && (
          <span className="text-xs text-slate-600">{count}건</span>
        )}
      </div>

      <div className="overflow-auto max-h-[480px] border border-slate-100 rounded">
        <table className="w-full text-sm text-slate-900">
          <thead className="bg-slate-50 sticky top-0 text-slate-600">
            <tr>
              <th className="text-left p-2 font-medium">cate</th>
              <th className="text-left p-2 font-medium">직종명</th>
              <th className="text-right p-2 font-medium">단가</th>
              <th className="text-left p-2 font-medium">단위</th>
              <th className="text-left p-2 font-medium">기준</th>
              <th className="text-left p-2 font-medium w-24">수집일</th>
              <th className="text-left p-2 font-medium">해설</th>
            </tr>
          </thead>
          <tbody className="bg-white text-slate-800">
            {wages.map((w) => (
              <tr
                key={w.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="p-2 font-mono text-slate-500">{w.cateCd}</td>
                <td className="p-2">{w.jobName}</td>
                <td className="p-2 text-right font-mono">
                  {w.price !== null ? w.price.toLocaleString() : "-"}
                </td>
                <td className="p-2 text-slate-700">{w.unit ?? "-"}</td>
                <td className="p-2 text-slate-700">{w.basis ?? "-"}</td>
                <td className="p-2 text-xs font-mono text-slate-600">
                  {ymd(w.fetchedAt)}
                </td>
                <td
                  className="p-2 text-xs text-slate-600 max-w-md truncate"
                  title={w.description ?? ""}
                >
                  {w.description ?? "-"}
                </td>
              </tr>
            ))}
            {wages.length === 0 && count !== null && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-400">
                  데이터 없음 — “수집” 탭에서 스크래핑을 먼저 실행하세요
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {recentRuns.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-slate-500">
            최근 수집 회차 ({recentRuns.length}건)
          </summary>
          <ul className="mt-2 text-xs space-y-1 font-mono">
            {recentRuns.map((r) => (
              <li key={r.id} className="text-slate-700">
                #{r.id} cate={r.cateCd} · {r._count.wages}건 ·{" "}
                {new Date(r.fetchedAt).toLocaleString("ko-KR")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
