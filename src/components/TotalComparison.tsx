import { Building2, Database, Sparkles, Wallet, Lock, Send } from "lucide-react";
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

interface Props {
  partnerTotal: number | null;
  partnerCostBreakdown: CostBreakdown;
  summary: SummaryRef | null;
  confTotal: number | null;
  confMatchedCount: number;
  competitorTotal: number | null;
  competitorBidCount: number;
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
  competitorTotal,
  competitorBidCount,
  itemMarketTotal,
  itemMarketBreakdown,
  itemTotalCount,
  itemMatchedCount,
}: Props) {
  const summaryDev = calcDeviation(partnerTotal, summary?.totalCost ?? null);
  const confDev = calcDeviation(partnerTotal, confTotal);
  const competitorDev = calcDeviation(partnerTotal, competitorTotal);
  const itemDev = calcDeviation(partnerTotal, itemMarketTotal);

  const summaryTone = deviationTone(summaryDev);
  const confTone = deviationTone(confDev);
  const competitorTone = deviationTone(competitorDev);
  const itemTone = deviationTone(itemDev);

  const breakdownRows: Array<{
    label: string;
    partner: number | null;
    summary: number | null;
    item: number | null;
  }> = [
    {
      label: "재료비",
      partner: partnerCostBreakdown.materialCost,
      summary: summary?.materialCost ?? null,
      item: itemMarketBreakdown.materialCost,
    },
    {
      label: "노무비",
      partner: partnerCostBreakdown.laborCost,
      summary: summary?.laborCost ?? null,
      item: itemMarketBreakdown.laborCost,
    },
    {
      label: "경비",
      partner: partnerCostBreakdown.expenseCost,
      summary: summary?.expenseCost ?? null,
      item: itemMarketBreakdown.expenseCost,
    },
  ];

  const summarySubLabel = summary ? "단가 자료 합계" : "매칭 자료 없음";
  const confSubLabel =
    confMatchedCount > 0 ? `매칭 ${confMatchedCount}건·단가×수량` : "매칭 없음";
  const competitorSubLabel =
    competitorBidCount > 0
      ? `${competitorBidCount}건 수령·최저가`
      : "수령된 견적 없음";
  const itemSubLabel =
    itemTotalCount === 0
      ? "라인 아이템 없음"
      : itemMatchedCount === 0
      ? "매칭된 항목 없음"
      : `매칭 ${itemMatchedCount}/${itemTotalCount}건 · 시장단가×수량`;

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
            <tr>
              <th className="text-left py-2 pl-5 pr-3 text-[11px] uppercase tracking-wide text-slate-500 font-semibold w-20">
                항목
              </th>
              <ColumnHeader label="협력사 견적" subLabel="기준값" accent="partner" />
              <ColumnHeader label="사내 DB 단가" subLabel={summarySubLabel} accent="summary" />
              <ColumnHeader label="기밀 단가" subLabel={confSubLabel} accent="conf" />
              <ColumnHeader label="경쟁 견적 단가" subLabel={competitorSubLabel} accent="competitor" />
              <ColumnHeader label="AI 매칭 단가" subLabel={itemSubLabel} accent="item" />
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
                competitor={null}
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
              competitorTotal={competitorTotal}
              competitorDev={competitorDev}
              competitorTone={competitorTone}
              itemTotal={itemMarketTotal}
              itemDev={itemDev}
              itemTone={itemTone}
            />
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ColumnHeader({
  label,
  subLabel,
  accent,
}: {
  label: string;
  subLabel: string;
  accent: ColumnAccent;
}) {
  const a = columnAccents[accent];
  const Icon = a.Icon;
  return (
    <th className="text-right py-2 px-3 align-bottom">
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
  competitor,
  item,
}: {
  label: string;
  partner: number | null;
  summary: number | null;
  conf: number | null;
  competitor: number | null;
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
      <BodyCell value={competitor} />
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
  competitorTotal,
  competitorDev,
  competitorTone,
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
  competitorTotal: number | null;
  competitorDev: number | null;
  competitorTone: Tone;
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
      <TotalCell value={competitorTotal} dev={competitorDev} tone={competitorTone} />
      <TotalCell value={itemTotal} dev={itemDev} tone={itemTone} />
    </tr>
  );
}

function TotalCell({
  value,
  dev,
  tone,
  isBase = false,
}: {
  value: number | null;
  dev: number | null;
  tone: Tone;
  isBase?: boolean;
}) {
  const bg = isBase ? "bg-slate-50/50" : toneCellBg[tone];

  return (
    <td className={`py-3 px-3 text-right align-top ${bg}`}>
      <div className="font-mono tabular-nums text-xl font-bold text-slate-900 leading-tight">
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
