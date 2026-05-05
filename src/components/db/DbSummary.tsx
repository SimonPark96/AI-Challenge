"use client";

import { useEffect, useState } from "react";
import {
  Database,
  FileBox,
  Layers3,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";

interface Summary {
  materials: number;
  scrapeRuns: number;
  priceHistory: number;
  priceSummary: number;
  quotations: number;
  embeddedHistory: number;
  embeddedSummary: number;
  bySource: { source: string; count: number }[];
}

export function DbSummary() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/db/summary");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Database size={18} className="text-blue-500" /> DB 현황
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs border border-slate-300 px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card
          icon={<Layers3 size={16} />}
          label="Material"
          value={data?.materials ?? "-"}
        />
        <Card
          icon={<FileBox size={16} />}
          label="ScrapeRun"
          value={data?.scrapeRuns ?? "-"}
        />
        <Card
          icon={<Database size={16} />}
          label="PriceHistory"
          sub="스크래핑 — 자재별"
          value={data?.priceHistory ?? "-"}
          extraSub={
            data
              ? `임베딩 ${data.embeddedHistory}/${data.priceHistory}`
              : undefined
          }
        />
        <Card
          icon={<Wallet size={16} />}
          label="PriceSummary"
          sub="일괄 등록 — 합계"
          value={data?.priceSummary ?? "-"}
          extraSub={
            data
              ? `임베딩 ${data.embeddedSummary}/${data.priceSummary}`
              : undefined
          }
        />
        <Card
          icon={<Receipt size={16} />}
          label="Quotation"
          value={data?.quotations ?? "-"}
        />
      </div>

      {data && data.bySource.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs text-slate-500 mb-2">
            PriceHistory by source
          </div>
          <div className="flex flex-wrap gap-2">
            {data.bySource.map((s) => (
              <span
                key={s.source}
                className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700"
              >
                {s.source}: <span className="font-mono">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Card({
  icon,
  label,
  value,
  sub,
  extraSub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  extraSub?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      {extraSub && (
        <div className="text-[11px] text-slate-400 mt-0.5">{extraSub}</div>
      )}
    </div>
  );
}
