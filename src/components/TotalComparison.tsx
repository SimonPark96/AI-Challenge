import { Building2, Database, Sparkles, Wallet, Lock, Send, TrendingDown, TrendingUp, CheckCircle2, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

interface CompetitorBidCol {
  id: number;
  companyName: string | null;
  totalCost: number | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
}

interface Props {
  partnerTotal: number | null;
  partnerCostBreakdown: CostBreakdown;
  summary: SummaryRef | null;
  confTotal: number | null;
  confMatchedCount: number;
  competitorBids: CompetitorBidCol[];
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
  if (partner == null || other == null || partner === 0) return null;
  return ((other - partner) / partner) * 100;
}

const toneCellBg: Record<Tone, string> = {
  high: "bg-rose-50/60",
  low: "bg-blue-50/60",
  ok: "bg-emerald-50/60",
  neutral: "bg-slate-50/60",
};

const toneLabels: Record<Tone, string> = {
  high: "협력사보다 비쌈",
  low: "협력사보다 저렴",
  ok: "적정 수준",
  neutral: "비교 불가",
};

const toneLabelColor: Record<Tone, string> = {
  high: "text-rose-700",
  low: "text-blue-700",
  ok: "text-emerald-700",
  neutral: "text-slate-500",
};

type ColumnAccent = "partner" | "summary" | "conf" | "competitor" | "item";

const columnAccents: Record<
  ColumnAccent,
  { Icon: LucideIcon; iconWrap: string }
> = {
  partner: {
    Icon: Building2,
    iconWrap: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60",
  },
  summary: {
    Icon: Database,
    iconWrap: "bg-sky-100 text-sky-600 ring-1 ring-sky-200/60",
  },
  conf: {
    Icon: Lock,
    iconWrap: "bg-rose-100 text-rose-600 ring-1 ring-rose-200/60",
  },
  competitor: {
    Icon: Send,
    iconWrap: "bg-amber-100 text-amber-600 ring-1 ring-amber-200/60",
  },
  item: {
    Icon: Sparkles,
    iconWrap: "bg-violet-100 text-violet-600 ring-1 ring-violet-200/60",
  },
};

export function TotalComparison({
  partnerTotal,
  partnerCostBreakdown,
  summary,
  confTotal,
  confMatchedCount,
  competitorBids,
  itemMarketTotal,
  itemMarketBreakdown,
  itemTotalCount,
  itemMatchedCount,
}: Props) {
  const summaryDev = calcDeviation(partnerTotal, summary?.totalCost ?? null);
  const confDev = calcDeviation(partnerTotal, confTotal);
  const itemDev = calcDeviation(partnerTotal, itemMarketTotal);

  const summaryTone = deviationTone(summaryDev);
  const confTone = deviationTone(confDev);
  const itemTone = deviationTone(itemDev);

  // 경쟁 견적 편차 (추천 의견용: 최소 편차 사용)
  const competitorDevs = competitorBids
    .map((b) => calcDeviation(partnerTotal, b.totalCost))
    .filter((d): d is number => d !== null);
  const competitorDev = competitorDevs.length > 0 ? Math.min(...competitorDevs) : null;

  // 경쟁 견적이 없을 때 플레이스홀더 1개 표시
  const displayCompetitorCols: CompetitorBidCol[] =
    competitorBids.length > 0
      ? competitorBids
      : [{ id: 0, companyName: null, totalCost: null, materialCost: null, laborCost: null, expenseCost: null }];

  const breakdownRows: Array<{
    label: string;
    partner: number | null;
    summary: number | null;
    competitors: (number | null)[];
    item: number | null;
  }> = [
    {
      label: "재료비",
      partner: partnerCostBreakdown.materialCost,
      summary: summary?.materialCost ?? null,
      competitors: displayCompetitorCols.map((b) => b.materialCost),
      item: itemMarketBreakdown.materialCost,
    },
    {
      label: "노무비",
      partner: partnerCostBreakdown.laborCost,
      summary: summary?.laborCost ?? null,
      competitors: displayCompetitorCols.map((b) => b.laborCost),
      item: itemMarketBreakdown.laborCost,
    },
    {
      label: "경비",
      partner: partnerCostBreakdown.expenseCost,
      summary: summary?.expenseCost ?? null,
      competitors: displayCompetitorCols.map((b) => b.expenseCost),
      item: itemMarketBreakdown.expenseCost,
    },
  ];

  const summarySubLabel = summary ? "단가 자료 합계" : "매칭 자료 없음";
  const confSubLabel =
    confMatchedCount > 0 ? `매칭 ${confMatchedCount}건·단가×수량` : "매칭 없음";
  const itemSubLabel =
    itemTotalCount === 0
      ? "라인 아이템 없음"
      : itemMatchedCount === 0
      ? "매칭된 항목 없음"
      : `매칭 ${itemMatchedCount}/${itemTotalCount}건 · 시장단가×수량`;

  const recommendation = buildRecommendation(
    partnerTotal,
    summaryDev,
    summary?.name ?? null,
    confDev,
    competitorDev,
    itemDev,
  );

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-sky-300 via-rose-300 via-amber-300 to-violet-300" />

      <div className="px-5 pt-4 pb-3">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 ring-1 ring-blue-200/50">
            <Wallet size={16} />
          </span>
          단가 합계 비교
        </h2>
        <div className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-[2.625rem]">
          {summary ? (
            <>
              매칭 자료: <span className="font-medium">{summary.name}</span>
              {summary.spec ? ` · ${summary.spec}` : ""}
              {summary.unit ? ` / ${summary.unit}` : ""}
              {summary.sourceFile
                ? ` · 출처: ${summary.sourceFile}${
                    summary.sourceVia ? ` (${summary.sourceVia})` : ""
                  }`
                : ""}
            </>
          ) : (
            "매칭 자료가 선택되지 않았습니다."
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-50/60">
            {/* 1행: 그룹 헤더 */}
            <tr>
              <th rowSpan={2} className="text-left py-2 pl-5 pr-3 text-[11px] uppercase tracking-wide text-slate-500 font-semibold w-20 align-bottom border-b border-slate-200">
                항목
              </th>
              <ColumnHeader rowSpan={2} label="협력사 견적" subLabel="기준값" accent="partner" />
              <ColumnHeader rowSpan={2} label="실적 단가" subLabel={summarySubLabel} accent="summary" />
              <ColumnHeader rowSpan={2} label="사내 DB 단가" subLabel={confSubLabel} accent="conf" />
              <th
                colSpan={displayCompetitorCols.length}
                className="text-center pt-2 pb-1.5 px-3 bg-amber-50/60 border-l-2 border-r-2 border-t border-amber-300/60"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-100 text-amber-600 ring-1 ring-amber-200/60">
                    <Send size={11} />
                  </span>
                  <span className="text-sm font-semibold text-slate-700">3사 견적 단가</span>
                </div>
              </th>
              <ColumnHeader rowSpan={2} label="AI 매칭 단가" subLabel={itemSubLabel} accent="item" />
            </tr>
            {/* 2행: 3사 견적 서브 헤더 */}
            <tr>
              {displayCompetitorCols.map((bid, i) => (
                <th
                  key={bid.id !== 0 ? bid.id : `empty-${i}`}
                  className={`text-right py-1.5 px-3 bg-amber-50/50 border-b border-amber-200/60
                    ${i === 0 ? "border-l-2 border-l-amber-300/60" : ""}
                    ${i === displayCompetitorCols.length - 1 ? "border-r-2 border-r-amber-300/60" : ""}
                  `}
                >
                  <div className="text-xs font-semibold text-amber-900 truncate max-w-[120px]">
                    {bid.id !== 0 ? (bid.companyName ?? `업체 ${i + 1}`) : "선택된 견적 없음"}
                  </div>
                  <div className="text-[10px] font-normal text-amber-500 mt-0.5">
                    {bid.id !== 0 ? "수령 견적" : "—"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdownRows.map((r) => (
              <BodyRow
                key={r.label}
                label={r.label}
                partner={r.partner}
                summary={r.summary}
                conf={null}
                competitors={r.competitors}
                item={r.item}
              />
            ))}
          </tbody>
          <tfoot>
            <TotalRow
              partnerTotal={partnerTotal}
              summaryTotal={summary?.totalCost ?? null}
              summaryDev={summaryDev}
              summaryTone={summaryTone}
              confTotal={confTotal}
              confDev={confDev}
              confTone={confTone}
              competitorCols={displayCompetitorCols.map((b) => ({
                total: b.totalCost,
                dev: calcDeviation(partnerTotal, b.totalCost),
                tone: deviationTone(calcDeviation(partnerTotal, b.totalCost)),
              }))}
              itemTotal={itemMarketTotal}
              itemDev={itemDev}
              itemTone={itemTone}
            />
          </tfoot>
        </table>
      </div>

      {/* AI 추천 의견 */}
      <PriceRecommendation recommendation={recommendation} />
    </section>
  );
}

function ColumnHeader({
  label,
  subLabel,
  accent,
  rowSpan = 1,
}: {
  label: string;
  subLabel: string;
  accent: ColumnAccent;
  rowSpan?: number;
}) {
  const a = columnAccents[accent];
  const Icon = a.Icon;
  return (
    <th rowSpan={rowSpan} className="text-right py-2 px-3 align-bottom border-b border-slate-200">
      <div className="flex items-center justify-end gap-1.5">
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded ${a.iconWrap}`}
        >
          <Icon size={11} />
        </span>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      </div>
      <div className="text-[10px] font-normal text-slate-400 mt-1 leading-tight">
        {subLabel}
      </div>
    </th>
  );
}

function BodyRow({
  label,
  partner,
  summary,
  conf,
  competitors,
  item,
}: {
  label: string;
  partner: number | null;
  summary: number | null;
  conf: number | null;
  competitors: (number | null)[];
  item: number | null;
}) {
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/40 transition-colors">
      <td className="py-2 pl-5 pr-3 text-slate-600 text-xs font-semibold">
        {label}
      </td>
      <BodyCell value={partner} />
      <BodyCell value={summary} />
      <BodyCell value={conf} />
      {competitors.map((c, i) => (
        <td
          key={i}
          className={`py-2 px-3 text-right bg-amber-50/30
            ${i === 0 ? "border-l-2 border-l-amber-300/50" : ""}
            ${i === competitors.length - 1 ? "border-r-2 border-r-amber-300/50" : ""}
          `}
        >
          <div className="font-mono tabular-nums text-slate-800">{fmt(c)}</div>
        </td>
      ))}
      <BodyCell value={item} />
    </tr>
  );
}

function BodyCell({ value }: { value: number | null }) {
  return (
    <td className="py-2 px-3 text-right">
      <div className="font-mono tabular-nums text-slate-800">{fmt(value)}</div>
    </td>
  );
}

function TotalRow({
  partnerTotal,
  summaryTotal,
  summaryDev,
  summaryTone,
  confTotal,
  confDev,
  confTone,
  competitorCols,
  itemTotal,
  itemDev,
  itemTone,
}: {
  partnerTotal: number | null;
  summaryTotal: number | null;
  summaryDev: number | null;
  summaryTone: Tone;
  confTotal: number | null;
  confDev: number | null;
  confTone: Tone;
  competitorCols: Array<{ total: number | null; dev: number | null; tone: Tone }>;
  itemTotal: number | null;
  itemDev: number | null;
  itemTone: Tone;
}) {
  return (
    <tr className="border-t-2 border-slate-200">
      <td className="py-3 pl-5 pr-3 text-slate-700 text-sm font-bold align-top bg-slate-50/40">
        합계
      </td>
      <TotalCell value={partnerTotal} dev={null} tone="neutral" isBase />
      <TotalCell value={summaryTotal} dev={summaryDev} tone={summaryTone} />
      <TotalCell value={confTotal} dev={confDev} tone={confTone} />
      {competitorCols.map((c, i) => (
        <TotalCell
          key={i}
          value={c.total}
          dev={c.dev}
          tone={c.tone}
          extraClass={`
            ${i === 0 ? "border-l-2 border-l-amber-300/60" : ""}
            ${i === competitorCols.length - 1 ? "border-r-2 border-r-amber-300/60" : ""}
          `}
        />
      ))}
      <TotalCell value={itemTotal} dev={itemDev} tone={itemTone} />
    </tr>
  );
}

function TotalCell({
  value,
  dev,
  tone,
  isBase = false,
  extraClass = "",
}: {
  value: number | null;
  dev: number | null;
  tone: Tone;
  isBase?: boolean;
  extraClass?: string;
}) {
  const bg = isBase ? "bg-slate-50/50" : toneCellBg[tone];

  return (
    <td className={`py-3 px-3 text-right align-top ${bg} ${extraClass}`}>
      <div className="font-mono tabular-nums text-sm font-bold text-slate-900 leading-tight whitespace-nowrap">
        {fmt(value)}
      </div>
      {isBase ? (
        <div className="text-[10px] text-slate-400 mt-1.5 font-medium uppercase tracking-wide">
          기준값
        </div>
      ) : dev != null ? (
        <div
          className={`mt-1.5 text-xs font-semibold ${toneLabelColor[tone]}`}
        >
          {toneLabels[tone]}
          <span className="ml-1.5 font-mono tabular-nums opacity-90">
            {dev > 0 ? "+" : ""}
            {dev.toFixed(1)}%
          </span>
        </div>
      ) : null}
    </td>
  );
}

// ── AI 추천 의견 ──────────────────────────────────────────

type RecAccent = "emerald" | "amber" | "rose" | "slate";

interface Recommendation {
  text: string;
  accent: RecAccent;
  bestRef: string | null;
  savingsPct: number | null;
}

function buildRecommendation(
  partnerTotal: number | null,
  summaryDev: number | null,
  summaryName: string | null,
  confDev: number | null,
  competitorDev: number | null,
  itemDev: number | null,
): Recommendation {
  const refs = [
    { label: summaryName ? `실적 단가(${summaryName})` : "실적 단가", dev: summaryDev },
    { label: "사내 DB 단가", dev: confDev },
    { label: "3사 견적 단가", dev: competitorDev },
    { label: "AI 매칭 단가", dev: itemDev },
  ].filter((r): r is { label: string; dev: number } => r.dev !== null);

  if (refs.length === 0 || partnerTotal === null) {
    return {
      text: "비교 가능한 단가 자료가 없어 추천 단가를 산출하기 어렵습니다. 사내 DB 매칭, 실적 단가 선택, 3사 견적 수령 후 재분석을 권장합니다.",
      accent: "slate",
      bestRef: null,
      savingsPct: null,
    };
  }

  // dev = (other - partner) / partner × 100
  // dev < 0 → reference cheaper than partner → partner is asking more than reference
  // dev > 0 → reference more expensive → partner's price is competitive

  const cheaperRefs = refs.filter((r) => r.dev < -5);
  const allCompetitive = refs.every((r) => r.dev > 5);

  if (allCompetitive) {
    return {
      text: "모든 비교 단가가 협력사 견적보다 높습니다. 협력사의 현재 단가는 시장 대비 경쟁력 있는 수준으로 판단되며, 발주 진행을 긍정적으로 검토할 수 있습니다.",
      accent: "emerald",
      bestRef: null,
      savingsPct: null,
    };
  }

  if (cheaperRefs.length > 0) {
    const sorted = [...cheaperRefs].sort((a, b) => a.dev - b.dev);
    const best = sorted[0];
    const pct = Math.abs(best.dev);
    const isSignificant = pct >= 15;

    return {
      text: isSignificant
        ? `${best.label}가 협력사 견적 대비 ${pct.toFixed(1)}% 낮아 상당한 원가 절감 여지가 있습니다. 해당 단가를 협상 기준가로 적극 활용하여 발주 단가 인하를 권장합니다.`
        : `${best.label}가 협력사 견적 대비 ${pct.toFixed(1)}% 낮은 수준입니다. 협상 시 해당 단가를 참고 자료로 활용하여 소폭 절감을 도모할 수 있습니다.`,
      accent: isSignificant ? "rose" : "amber",
      bestRef: best.label,
      savingsPct: pct,
    };
  }

  return {
    text: "비교 단가가 협력사 견적과 유사한 수준(±5% 이내)으로 협력사 단가는 시장 대비 적정한 것으로 판단됩니다.",
    accent: "emerald",
    bestRef: null,
    savingsPct: null,
  };
}

const recBg: Record<RecAccent, string> = {
  emerald: "bg-emerald-50 border-emerald-200",
  amber: "bg-amber-50 border-amber-200",
  rose: "bg-rose-50 border-rose-200",
  slate: "bg-slate-50 border-slate-200",
};

const recIconBg: Record<RecAccent, string> = {
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
  slate: "bg-slate-100 text-slate-500",
};

const recText: Record<RecAccent, string> = {
  emerald: "text-emerald-800",
  amber: "text-amber-800",
  rose: "text-rose-800",
  slate: "text-slate-700",
};

const recLabel: Record<RecAccent, string> = {
  emerald: "적정 수준",
  amber: "절감 여지",
  rose: "협상 권장",
  slate: "자료 부족",
};

function PriceRecommendation({ recommendation: rec }: { recommendation: Recommendation }) {
  const Icon =
    rec.accent === "emerald"
      ? CheckCircle2
      : rec.accent === "rose"
      ? TrendingDown
      : rec.accent === "amber"
      ? TrendingUp
      : Info;

  return (
    <div className={`mx-5 mb-5 mt-1 rounded-lg border p-4 ${recBg[rec.accent]}`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${recIconBg[rec.accent]}`}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              AI 추천 의견
            </span>
            <span
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${recIconBg[rec.accent]} ${recText[rec.accent]}`}
            >
              {recLabel[rec.accent]}
            </span>
            {rec.savingsPct !== null && (
              <span className="text-[11px] font-mono font-semibold text-rose-600 ml-1">
                -{rec.savingsPct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className={`text-sm leading-relaxed font-medium ${recText[rec.accent]}`}>
            {rec.text}
          </p>
        </div>
      </div>
    </div>
  );
}
