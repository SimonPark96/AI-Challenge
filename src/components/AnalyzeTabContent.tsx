"use client";

import { useRequestStore } from "@/lib/stores/request-store";

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() + "원" : "-";
}

function pctBadge(pct: number | null) {
  if (pct === null) return <span className="text-slate-400 text-xs">-</span>;
  const sign = pct > 0 ? "+" : "";
  const abs = Math.abs(pct);
  const color =
    abs <= 5
      ? "bg-emerald-50 text-emerald-700"
      : abs <= 15
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${color}`}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

interface ConfItem {
  id: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  confUnitPrice: number | null;
  matchedConfidence: number | null;
  deviationPct: number | null;
}

interface PriceSummaryData {
  name: string;
  spec: string | null;
  unit: string | null;
  totalCost: number | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  sourceFile: string | null;
}

interface CompetitorBid {
  id: number;
  companyName: string | null;
  totalCost: number | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
}

interface Props {
  confItems: ConfItem[];
  priceSummary: PriceSummaryData | null;
  competitorBids: CompetitorBid[];
  partnerTotal: number | null;
}

function DbTab({ confItems }: { confItems: ConfItem[] }) {
  const matched = confItems.filter((it) => it.confUnitPrice != null);
  if (matched.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        사내 DB와 매칭된 항목이 없습니다.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
            <th className="text-left py-2 pr-4 font-medium">품목명</th>
            <th className="text-left py-2 pr-4 font-medium">규격</th>
            <th className="text-right py-2 pr-4 font-medium">단위</th>
            <th className="text-right py-2 pr-4 font-medium">수량</th>
            <th className="text-right py-2 pr-4 font-medium">협력사 단가</th>
            <th className="text-right py-2 pr-4 font-medium">DB 단가</th>
            <th className="text-right py-2 font-medium">괴리율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {matched.map((it) => {
            const dev =
              it.confUnitPrice != null && it.unitPrice != null && it.unitPrice !== 0
                ? ((it.unitPrice - it.confUnitPrice) / it.confUnitPrice) * 100
                : it.deviationPct;
            return (
              <tr key={it.id} className="hover:bg-slate-50">
                <td className="py-2 pr-4 text-slate-800">{it.itemName}</td>
                <td className="py-2 pr-4 text-slate-500 max-w-[160px] truncate">{it.spec ?? "-"}</td>
                <td className="py-2 pr-4 text-right text-slate-500">{it.unit ?? "-"}</td>
                <td className="py-2 pr-4 text-right text-slate-700">{it.quantity?.toLocaleString() ?? "-"}</td>
                <td className="py-2 pr-4 text-right text-slate-700">{fmt(it.unitPrice)}</td>
                <td className="py-2 pr-4 text-right font-medium text-blue-700">{fmt(it.confUnitPrice)}</td>
                <td className="py-2 text-right">{pctBadge(dev)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-3">
        총 {confItems.length}개 항목 중 {matched.length}개 매칭 (
        {Math.round((matched.length / confItems.length) * 100)}%)
      </p>
    </div>
  );
}

function ActualTab({ priceSummary, partnerTotal }: { priceSummary: PriceSummaryData | null; partnerTotal: number | null }) {
  if (!priceSummary) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        매칭된 실적단가 데이터가 없습니다.
      </p>
    );
  }
  const rows: { label: string; value: number | null }[] = [
    { label: "합계", value: priceSummary.totalCost },
    { label: "재료비", value: priceSummary.materialCost },
    { label: "노무비", value: priceSummary.laborCost },
    { label: "경비", value: priceSummary.expenseCost },
  ];
  const devPct =
    partnerTotal != null && priceSummary.totalCost != null && priceSummary.totalCost !== 0
      ? ((partnerTotal - priceSummary.totalCost) / priceSummary.totalCost) * 100
      : null;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{priceSummary.name}</p>
          {priceSummary.spec && (
            <p className="text-xs text-slate-500 mt-0.5">{priceSummary.spec}</p>
          )}
          {priceSummary.sourceFile && (
            <p className="text-xs text-slate-400 mt-0.5">출처: {priceSummary.sourceFile}</p>
          )}
        </div>
        {devPct !== null && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400 mb-1">협력사 대비</p>
            {pctBadge(devPct)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map((r) => (
          <div key={r.label} className="bg-slate-50 rounded p-3">
            <p className="text-xs text-slate-500">{r.label}</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">{fmt(r.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BidTab({ competitorBids, partnerTotal }: { competitorBids: CompetitorBid[]; partnerTotal: number | null }) {
  if (competitorBids.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        비교 견적 데이터가 없습니다.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
            <th className="text-left py-2 pr-4 font-medium">업체명</th>
            <th className="text-right py-2 pr-4 font-medium">재료비</th>
            <th className="text-right py-2 pr-4 font-medium">노무비</th>
            <th className="text-right py-2 pr-4 font-medium">경비</th>
            <th className="text-right py-2 pr-4 font-medium">합계</th>
            <th className="text-right py-2 font-medium">협력사 대비</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {competitorBids.map((b, i) => {
            const dev =
              partnerTotal != null && b.totalCost != null && b.totalCost !== 0
                ? ((partnerTotal - b.totalCost) / b.totalCost) * 100
                : null;
            return (
              <tr key={b.id > 0 ? b.id : i} className="hover:bg-slate-50">
                <td className="py-2 pr-4 text-slate-800">{b.companyName ?? `업체 ${i + 1}`}</td>
                <td className="py-2 pr-4 text-right text-slate-600">{fmt(b.materialCost)}</td>
                <td className="py-2 pr-4 text-right text-slate-600">{fmt(b.laborCost)}</td>
                <td className="py-2 pr-4 text-right text-slate-600">{fmt(b.expenseCost)}</td>
                <td className="py-2 pr-4 text-right font-medium text-slate-800">{fmt(b.totalCost)}</td>
                <td className="py-2 text-right">{pctBadge(dev)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AnalyzeTabContent({ confItems, priceSummary, competitorBids, partnerTotal }: Props) {
  const activeTab = useRequestStore((s) => s.activeDataTab);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      {activeTab === "db" && <DbTab confItems={confItems} />}
      {activeTab === "actual" && <ActualTab priceSummary={priceSummary} partnerTotal={partnerTotal} />}
      {activeTab === "bid" && <BidTab competitorBids={competitorBids} partnerTotal={partnerTotal} />}
    </div>
  );
}
