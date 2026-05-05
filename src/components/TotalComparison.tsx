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

interface CostBreakdown {
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
}

interface Props {
  partnerTotal: number | null;
  partnerCostBreakdown: CostBreakdown;
  summary: SummaryRef | null;
  itemMarketTotal: number | null;
  itemMarketBreakdown: CostBreakdown;
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
  high: "text-rose-700 bg-rose-50 border-rose-200",
  low: "text-blue-700 bg-blue-50 border-blue-200",
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
  neutral: "text-slate-600 bg-slate-50 border-slate-200",
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
  itemMarketBreakdown,
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
        <CompositeCard
          label="협력사 합계"
          total={partnerTotal}
          breakdown={partnerCostBreakdown}
          mode="base"
        />
        <CompositeCard
          label="매칭 자료 합계"
          total={summary?.totalCost ?? null}
          breakdown={
            summary
              ? {
                  materialCost: summary.materialCost,
                  laborCost: summary.laborCost,
                  expenseCost: summary.expenseCost,
                }
              : { materialCost: null, laborCost: null, expenseCost: null }
          }
          mode="dev"
          dev={summaryDev}
          fallback={summary ? null : "매칭 자료 없음"}
          partnerBreakdown={partnerCostBreakdown}
        />
        <CompositeCard
          label="세부 항목별 단가 합계"
          total={itemMarketTotal}
          breakdown={itemMarketBreakdown}
          mode="dev"
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
              ? `매칭 ${itemMatchedCount}/${itemTotalCount}건의 시장단가 × 수량 합산 — 재료비=자재 매칭, 노무비=노임 매칭, 경비는 라인에서 도출 불가`
              : undefined
          }
          partnerBreakdown={partnerCostBreakdown}
        />
      </div>
    </section>
  );
}

interface CardProps {
  label: string;
  total: number | null;
  breakdown: CostBreakdown;
  mode: "base" | "dev";
  dev?: number | null;
  fallback?: string | null;
  subText?: string;
  /** 매칭/세부 카드에서 라인별 재료비·노무비·경비 편차(% vs 협력사) 계산용 */
  partnerBreakdown?: CostBreakdown;
}

function CompositeCard({
  label,
  total,
  breakdown,
  mode,
  dev = null,
  fallback,
  subText,
  partnerBreakdown,
}: CardProps) {
  if (fallback) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 bg-slate-50/50 min-h-[180px]">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-sm text-slate-400 mt-2">{fallback}</div>
      </div>
    );
  }

  if (mode === "base") {
    return (
      <div className="rounded-lg border border-slate-300 px-4 py-3 bg-white">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-2xl font-bold text-slate-800 mt-1">
          {fmt(total)}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">기준값</div>

        <BreakdownList
          breakdown={breakdown}
          tone="neutral"
        />
      </div>
    );
  }

  const tone = deviationTone(dev);
  const ToneIcon =
    tone === "high"
      ? ArrowUpRight
      : tone === "low"
        ? ArrowDownRight
        : Minus;

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClasses[tone]}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 text-slate-800">{fmt(total)}</div>
      <div className="flex items-center gap-1.5 mt-1 text-xs">
        <ToneIcon size={14} />
        <span className="font-mono">
          {dev != null ? `${dev > 0 ? "+" : ""}${dev.toFixed(1)}%` : "-"}
        </span>
        <span className="opacity-80">vs 협력사</span>
      </div>
      <div className="text-[11px] mt-1 opacity-80">{toneLabels[tone]}</div>

      <BreakdownList
        breakdown={breakdown}
        tone={tone}
        partnerBreakdown={partnerBreakdown}
      />

      {subText && (
        <div className="text-[11px] mt-2 opacity-70 leading-relaxed">
          {subText}
        </div>
      )}
    </div>
  );
}

function BreakdownList({
  breakdown,
  tone,
  partnerBreakdown,
}: {
  breakdown: CostBreakdown;
  tone: Tone;
  partnerBreakdown?: CostBreakdown;
}) {
  const items: Array<{
    label: string;
    value: number | null;
    partner: number | null;
  }> = [
    {
      label: "재료비",
      value: breakdown.materialCost,
      partner: partnerBreakdown?.materialCost ?? null,
    },
    {
      label: "노무비",
      value: breakdown.laborCost,
      partner: partnerBreakdown?.laborCost ?? null,
    },
    {
      label: "경비",
      value: breakdown.expenseCost,
      partner: partnerBreakdown?.expenseCost ?? null,
    },
  ];

  return (
    <div className="mt-3 pt-3 border-t border-current/20 space-y-1">
      {items.map((it) => (
        <BreakdownRow
          key={it.label}
          label={it.label}
          value={it.value}
          partner={it.partner}
          showDeviation={!!partnerBreakdown}
          tone={tone}
        />
      ))}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  partner,
  showDeviation,
  tone,
}: {
  label: string;
  value: number | null;
  partner: number | null;
  showDeviation: boolean;
  tone: Tone;
}) {
  // 협력사 자기 자신과의 비교는 의미 없으므로 base 모드에선 dev 숨김
  const dev = showDeviation ? calcDeviation(partner, value) : null;
  const devCls =
    dev == null
      ? "text-slate-400"
      : dev > 10
        ? "text-rose-700"
        : dev < -10
          ? "text-blue-700"
          : "text-emerald-700";
  return (
    <div className="flex items-center justify-between text-xs">
      <span
        className={
          tone === "neutral" ? "text-slate-500" : "text-slate-700 opacity-90"
        }
      >
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm text-slate-800">{fmt(value)}</span>
        {showDeviation && dev != null && (
          <span className={`font-mono text-[11px] ${devCls}`}>
            {dev > 0 ? "+" : ""}
            {dev.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
