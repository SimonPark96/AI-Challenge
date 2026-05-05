"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, FileBox, HardHat, Layers3, Receipt, RefreshCw, Wallet } from "lucide-react";

interface Summary {
  materials: number;
  scrapeRuns: number;
  priceHistory: number;
  priceSummary: number;
  quotations: number;
  embeddedHistory: number;
  embeddedSummary: number;
  wageRuns: number;
  wageHistory: number;
  bySource: { source: string; count: number }[];
  wageByCate: { cateCd: string; count: number }[];
}

const WAGE_CATE_LABELS: Record<string, string> = {
  "701111": "공사부문",
  "701115": "기타직종",
};

async function fetchSummary(): Promise<Summary | null> {
  try {
    const res = await fetch("/api/db/summary");
    if (!res.ok) return null;
    return (await res.json()) as Summary;
  } catch {
    return null;
  }
}

export function DbSummary() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // 수동 Refresh 버튼용 — 이벤트 핸들러 컨텍스트이므로 setLoading(true) 안전.
  const refresh = useCallback(async () => {
    setLoading(true);
    const d = await fetchSummary();
    if (d) setData(d);
    setLoading(false);
  }, []);

  // 초기 로드 — fetch 결과는 microtask(.then) 에서 setState 하므로 effect 본문에 동기 setState 없음.
  useEffect(() => {
    let cancelled = false;
    fetchSummary().then((response) => {
      if (cancelled) return;
      if (response) setData(response);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card icon={<Layers3 size={16} />} label="자재 마스터" value={data?.materials ?? "-"} />
        <Card
          icon={<FileBox size={16} />}
          label="수집 회차"
          sub="스크래핑 1회 = 1회차"
          value={data?.scrapeRuns ?? "-"}
        />
        <Card
          icon={<Database size={16} />}
          label="자재 단가"
          sub="외부 사이트 스크래핑"
          value={data?.priceHistory ?? "-"}
          extraSub={data ? `임베딩 ${data.embeddedHistory}/${data.priceHistory}` : undefined}
        />
        <Card
          icon={<HardHat size={16} />}
          label="노임 단가"
          sub="KPI 직종별 일당"
          value={data?.wageHistory ?? "-"}
          extraSub={data ? `수집 회차 ${data.wageRuns}` : undefined}
        />
        <Card
          icon={<Wallet size={16} />}
          label="일괄 단가"
          sub="엑셀/이미지 일괄 등록"
          value={data?.priceSummary ?? "-"}
          extraSub={data ? `임베딩 ${data.embeddedSummary}/${data.priceSummary}` : undefined}
        />
        <Card icon={<Receipt size={16} />} label="견적" sub="단가 검토 요청" value={data?.quotations ?? "-"} />
      </div>

      {data && (data.bySource.length > 0 || data.wageByCate.length > 0) && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          {data.bySource.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-2">자재 단가 — 출처별</div>
              <div className="flex flex-wrap gap-2">
                {data.bySource.map((s) => (
                  <span key={s.source} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                    {s.source}: <span className="font-mono">{s.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.wageByCate.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-2">노임 단가 — 카테고리별</div>
              <div className="flex flex-wrap gap-2">
                {data.wageByCate.map((w) => (
                  <span key={w.cateCd} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-800">
                    {WAGE_CATE_LABELS[w.cateCd] ?? w.cateCd}: <span className="font-mono">{w.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
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
      {extraSub && <div className="text-[11px] text-slate-400 mt-0.5">{extraSub}</div>}
    </div>
  );
}
