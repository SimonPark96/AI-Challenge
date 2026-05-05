"use client";

import { useCallback, useState } from "react";
import { Search, Trash2, Wallet } from "lucide-react";

interface SummaryRow {
  id: number;
  name: string;
  spec: string | null;
  unit: string | null;
  totalCost: number | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  sourceFile: string | null;
  sourceVia: string | null;
  fetchedAt: string;
  hasEmbedding: boolean;
  embeddingDim: number;
}

function fmt(n: number | null): string {
  return n != null ? n.toLocaleString() : "-";
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

export function DbPriceSummarySearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setCount(null);
    try {
      const params = new URLSearchParams({ limit: "10000" });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/price-summary?${params.toString()}`);
      const data = await res.json();
      setRows(data.summaries ?? []);
      setCount(data.count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [q]);

  async function onDelete(row: SummaryRow) {
    if (
      !window.confirm(
        `"${row.name}${row.spec ? ` / ${row.spec}` : ""}" 항목을 삭제할까요?`
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/price-summary/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setCount((c) => (c != null ? c - 1 : c));
    } catch (err) {
      window.alert(
        `삭제 실패: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
        <Wallet size={18} className="text-blue-500" />
        일괄 단가 검색
        <span className="text-[11px] font-normal text-slate-400">
          (엑셀/이미지 일괄 등록 — 명칭·규격 합계)
        </span>
      </h2>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="명칭 또는 규격 검색 (공백 분리 시 모든 토큰 포함)"
          className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[260px]"
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Search size={14} /> {loading ? "..." : "조회"}
        </button>
        {count !== null && (
          <span className="text-xs text-slate-500">{count}건</span>
        )}
      </div>

      <div className="overflow-auto max-h-[480px]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-2 font-medium text-slate-600">id</th>
              <th className="text-left p-2 font-medium text-slate-600">
                명칭
              </th>
              <th className="text-left p-2 font-medium text-slate-600">
                규격
              </th>
              <th className="text-left p-2 font-medium text-slate-600">
                단위
              </th>
              <th className="text-right p-2 font-medium text-slate-600">
                합계
              </th>
              <th className="text-right p-2 font-medium text-slate-600">
                재료비
              </th>
              <th className="text-right p-2 font-medium text-slate-600">
                노무비
              </th>
              <th className="text-right p-2 font-medium text-slate-600">
                경비
              </th>
              <th className="text-left p-2 font-medium text-slate-600">
                소스
              </th>
              <th className="text-left p-2 font-medium text-slate-600 w-24">
                수집일
              </th>
              <th className="text-center p-2 font-medium text-slate-600">
                embed
              </th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${
                  deletingId === r.id ? "opacity-50" : ""
                }`}
              >
                <td className="p-2 font-mono text-slate-500">{r.id}</td>
                <td className="p-2 text-slate-800">{r.name}</td>
                <td className="p-2 text-slate-600">{r.spec ?? "-"}</td>
                <td className="p-2 text-slate-600">{r.unit ?? "-"}</td>
                <td className="p-2 text-right font-mono font-semibold text-slate-800">
                  {fmt(r.totalCost)}
                </td>
                <td className="p-2 text-right font-mono text-slate-600">
                  {fmt(r.materialCost)}
                </td>
                <td className="p-2 text-right font-mono text-slate-600">
                  {fmt(r.laborCost)}
                </td>
                <td className="p-2 text-right font-mono text-slate-600">
                  {fmt(r.expenseCost)}
                </td>
                <td className="p-2 text-xs text-slate-500">
                  <div className="truncate max-w-[180px]">
                    {r.sourceFile ?? "-"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {r.sourceVia ?? "-"}
                  </div>
                </td>
                <td className="p-2 text-xs font-mono text-slate-600">
                  {ymd(r.fetchedAt)}
                </td>
                <td className="p-2 text-center text-xs">
                  {r.hasEmbedding ? (
                    <span className="text-emerald-600">✓</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="p-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    disabled={deletingId === r.id}
                    title="삭제"
                    className="text-slate-400 hover:text-rose-500 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && count !== null && (
              <tr>
                <td
                  colSpan={12}
                  className="p-4 text-center text-slate-400"
                >
                  결과 없음
                </td>
              </tr>
            )}
            {count === null && (
              <tr>
                <td
                  colSpan={12}
                  className="p-4 text-center text-slate-400"
                >
                  조회 버튼을 눌러주세요 (검색어 비우면 전체 표시)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
