import { ArrowDownRight, ArrowUpRight, Minus, Wallet } from "lucide-react";

interface SummaryRef {
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
}

interface Props {
  partnerTotal: number | null;
  partnerCostBreakdown: {
    materialCost: number | null;
    laborCost: number | null;
    expenseCost: number | null;
  };
  summary: SummaryRef | null;
  itemMarketTotal: number | null;
  itemTotalCount: number;
  itemMatchedCount: number;
}

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() + "원" : "-";
}

type Tone = "high" | "low" | "ok" | "neutral";

function deviationTone(dev: number | null): Tone {
  if (dev == null) return "neutral";
  if (dev > 10) return "high";
  if (dev < -10) return "low";
  return "ok";
}

function calcDeviation(
  partner: number | null,
  other: number | null
): number | null {
  if (partner == null || other == null || other === 0) return null;
  return ((partner - other) / other) * 100;
}

const toneClasses: Record<Tone, string> = {
  high: "text-rose-600 bg-rose-50 border-rose-200",
  low: "text-blue-600 bg-blue-50 border-blue-200",
  ok: "text-emerald-600 bg-emerald-50 border-emerald-200",
  neutral: "text-slate-500 bg-slate-50 border-slate-200",
};

const toneLabels: Record<Tone, string> = {
  high: "협력사가 비쌈",
  low: "협력사가 저렴",
  ok: "적정 수준",
  neutral: "비교 불가",
};

export function TotalComparison({
  partnerTotal,
  partnerCostBreakdown,
  summary,
  itemMarketTotal,
  itemTotalCount,
  itemMatchedCount,
}: Props) {
  const summaryDev = calcDeviation(partnerTotal, summary?.totalCost ?? null);
  const itemDev = calcDeviation(partnerTotal, itemMarketTotal);

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Wallet size={18} className="text-blue-500" />
          단가 합계 비교
        </h2>
        <div className="text-xs text-slate-500 mt-1 leading-relaxed">
          {summary ? (
            <>
              매칭 자료:{" "}
              <span className="font-medium">{summary.name}</span>
              {summary.spec ? ` · ${summary.spec}` : ""}
              {summary.unit ? ` / ${summary.unit}` : ""}
              {summary.sourceFile
                ? ` · 출처: ${summary.sourceFile}${summary.sourceVia ? ` (${summary.sourceVia})` : ""}`
                : ""}
            </>
          ) : (
            "매칭 자료가 선택되지 않았습니다."
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BaseCard label="협력사 합계" value={fmt(partnerTotal)} />
        <DevCard
          label="매칭 자료 합계"
          value={fmt(summary?.totalCost ?? null)}
          dev={summaryDev}
          fallback={summary ? null : "매칭 자료 없음"}
        />
        <DevCard
          label="세부 항목별 단가 합계"
          value={fmt(itemMarketTotal)}
          dev={itemDev}
          fallback={
            itemTotalCount === 0
              ? "라인 아이템 없음"
              : itemMatchedCount === 0
                ? "매칭된 항목 없음"
                : null
          }
          subText={
            itemTotalCount > 0
              ? `매칭 ${itemMatchedCount}/${itemTotalCount}건의 시장단가 × 수량 합산`
              : undefined
          }
        />
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4 text-sm border-t border-slate-100 pt-4">
          <BreakdownPair
            label="재료비"
            partner={partnerCostBreakdown.materialCost}
            summary={summary.materialCost}
          />
          <BreakdownPair
            label="노무비"
            partner={partnerCostBreakdown.laborCost}
            summary={summary.laborCost}
          />
          <BreakdownPair
            label="경비"
            partner={partnerCostBreakdown.expenseCost}
            summary={summary.expenseCost}
          />
        </div>
      )}
    </section>
  );
}

function BaseCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      <div className="text-[11px] text-slate-400 mt-1">기준값</div>
    </div>
  );
}

function DevCard({
  label,
  value,
  dev,
  fallback,
  subText,
}: {
  label: string;
  value: string;
  dev: number | null;
  fallback?: string | null;
  subText?: string;
}) {
  const tone = deviationTone(dev);
  const ToneIcon =
    tone === "high"
      ? ArrowUpRight
      : tone === "low"
        ? ArrowDownRight
        : Minus;

  if (fallback) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 bg-slate-50/50">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-sm text-slate-400 mt-1">{fallback}</div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClasses[tone]}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 text-slate-800">{value}</div>
      <div className="flex items-center gap-1.5 mt-1 text-xs">
        <ToneIcon size={14} />
        <span className="font-mono">
          {dev != null
            ? `${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`
            : "-"}
        </span>
        <span className="opacity-80">vs 협력사</span>
      </div>
      {subText && (
        <div className="text-[11px] mt-1 opacity-70">{subText}</div>
      )}
      <div className="text-[11px] mt-1 opacity-80">{toneLabels[tone]}</div>
    </div>
  );
}

function BreakdownPair({
  label,
  partner,
  summary,
}: {
  label: string;
  partner: number | null;
  summary: number | null;
}) {
  const diff = calcDeviation(partner, summary);
  const diffCls =
    diff == null
      ? "text-slate-400"
      : diff > 10
        ? "text-rose-600"
        : diff < -10
          ? "text-blue-600"
          : "text-emerald-600";
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm text-slate-700 mt-0.5">
        협력사 <span className="font-mono">{fmt(partner)}</span>
      </div>
      <div className="text-sm text-slate-500 mt-0.5">
        매칭 <span className="font-mono">{fmt(summary)}</span>
      </div>
      <div className={`text-xs mt-1 font-mono ${diffCls}`}>
        {diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%` : "-"}
      </div>
    </div>
  );
}
