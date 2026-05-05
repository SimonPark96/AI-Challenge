"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface PriceRow {
  id: number;
  scrapeRunId: number;
  source: string;
  itemName: string;
  spec: string | null;
  unit: string | null;
  region: string | null;
  price: number | null;
  fetchedAt: string;
  hasEmbedding: boolean;
  embeddingDim: number;
}

export function DbSearch() {
  const [source, setSource] = useState("");
  const [itemName, setItemName] = useState("");
  const [region, setRegion] = useState("");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  async function search() {
    setLoading(true);
    setCount(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (source) params.set("source", source);
      if (itemName.trim()) params.set("itemName", itemName.trim());
      if (region.trim()) params.set("region", region.trim());
      const res = await fetch(`/api/prices?${params.toString()}`);
      const data = await res.json();
      setRows(data.prices ?? []);
      setCount(data.count ?? 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
        <Search size={18} className="text-blue-500" /> PriceHistory 검색
        <span className="text-[11px] font-normal text-slate-400">
          (스크래핑 — 자재별)
        </span>
      </h2>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900"
        >
          <option value="">전체 소스</option>
          <option value="kpi">kpi</option>
          <option value="kprc">kprc</option>
          <option value="cmpi">cmpi</option>
          <option value="external">external (legacy 엑셀)</option>
          <option value="external-image">external-image (legacy 이미지)</option>
        </select>
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="품명 (부분일치)"
          className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[200px] bg-white text-slate-900 placeholder:text-slate-400"
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="지역"
          className="border border-slate-300 rounded px-2 py-1.5 text-sm w-28 bg-white text-slate-900 placeholder:text-slate-400"
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {loading ? "..." : "조회"}
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
              <th className="text-left p-2 font-medium text-slate-600">source</th>
              <th className="text-left p-2 font-medium text-slate-600">품명</th>
              <th className="text-left p-2 font-medium text-slate-600">규격</th>
              <th className="text-left p-2 font-medium text-slate-600">단위</th>
              <th className="text-left p-2 font-medium text-slate-600">지역</th>
              <th className="text-right p-2 font-medium text-slate-600">단가</th>
              <th className="text-center p-2 font-medium text-slate-600">embed</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="p-2 font-mono text-slate-500">{p.id}</td>
                <td className="p-2">{p.source}</td>
                <td className="p-2">{p.itemName}</td>
                <td className="p-2 text-slate-700">{p.spec ?? "-"}</td>
                <td className="p-2 text-slate-700">{p.unit ?? "-"}</td>
                <td className="p-2 text-slate-700">{p.region ?? "-"}</td>
                <td className="p-2 text-right font-mono">
                  {p.price !== null ? p.price.toLocaleString() : "-"}
                </td>
                <td className="p-2 text-center text-xs">
                  {p.hasEmbedding ? (
                    <span className="text-emerald-600">✓</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && count !== null && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-400">
                  결과 없음
                </td>
              </tr>
            )}
            {count === null && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-400">
                  조회 버튼을 눌러주세요
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
