import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StepIndicator } from "@/components/StepIndicator";
import { AnalyzePageClient } from "@/components/AnalyzePageClient";
import { ReviewDecisionCard } from "@/components/ReviewDecisionCard";
import { NewPriceReviewForm } from "@/components/NewPriceReviewForm";
import { ConfirmAndOrderSection } from "@/components/ConfirmAndOrderSection";

export const dynamic = "force-dynamic";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export default async function ConfirmByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const qid = Number(id);
  if (!Number.isFinite(qid) || qid <= 0) notFound();

  const [quotation, bidRequests] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id: qid },
      include: {
        items: {
          orderBy: { rowIndex: "asc" },
          include: {
            matchedPrice: true,
            matchedWage: { include: { wageRun: true } },
          },
        },
        priceSummary: true,
      },
    }),
    prisma.bidRequest.findMany({
      where: { quotationId: qid },
      include: { receivedBids: { include: { items: true } } },
    }),
  ]);
  if (!quotation) notFound();

  const meta =
    typeof quotation.rawResponse === "object" &&
    quotation.rawResponse !== null &&
    !Array.isArray(quotation.rawResponse)
      ? (quotation.rawResponse as Record<string, unknown>)
      : null;

  const items = quotation.items;

  // ── 판정 지표 ──────────────────────────────────────────
  const itemCount = items.length;
  const matchedCount = items.filter((it) => it.matchedPriceId != null).length;
  const matchRate = itemCount > 0 ? matchedCount / itemCount : 0;
  const devs = items.map((it) => it.deviationPct).filter((d): d is number => d != null);
  const avgDev = devs.length > 0 ? devs.reduce((a, b) => a + b, 0) / devs.length : null;
  const overCount = devs.filter((d) => d > 10).length;
  const underCount = devs.filter((d) => d < -10).length;

  const itemMatched = items.filter((it) => it.marketPrice != null);
  const itemMarketTotal =
    itemMatched.length > 0
      ? itemMatched.reduce((a, it) => a + (it.marketPrice ?? 0) * (it.quantity ?? 1), 0)
      : null;

  const decision: { label: string; tone: "slate" | "rose" | "blue" | "emerald" } =
    matchRate < 0.5
      ? { label: "검토 필요", tone: "slate" }
      : overCount * 2 > itemCount || (avgDev != null && avgDev > 10)
        ? { label: "협상 권고", tone: "rose" }
        : underCount * 2 > itemCount || (avgDev != null && avgDev < -10)
          ? { label: "재확인 권고", tone: "blue" }
          : { label: "적정 단가", tone: "emerald" };

  // ── 탭에 필요한 데이터 ────────────────────────────────
  const partnerTotal =
    num(meta?.partnerPrice) ??
    (items.reduce((a, it) => a + (it.totalPrice ?? 0), 0) || null);

  const partnerCostBreakdown = {
    materialCost: num(meta?.materialCost),
    laborCost: num(meta?.laborCost),
    expenseCost: num(meta?.expenseCost),
  };

  const confMatched = items.filter((it) => it.confUnitPrice != null);
  const confTotal =
    confMatched.length > 0
      ? confMatched.reduce((a, it) => a + (it.confUnitPrice ?? 0) * (it.quantity ?? 1), 0)
      : null;

  interface CompetitorBidCol {
    id: number;
    companyName: string | null;
    totalCost: number | null;
    materialCost: number | null;
    laborCost: number | null;
    expenseCost: number | null;
  }
  let competitorBids: CompetitorBidCol[] = [];
  const metaCB = Array.isArray(meta?.competitorBids) ? (meta.competitorBids as CompetitorBidCol[]) : [];
  if (metaCB.length > 0) {
    competitorBids = metaCB;
  } else {
    const legacyTotal = num(meta?.competitorTotal);
    if (legacyTotal !== null) {
      competitorBids = [{ id: 0, companyName: null, totalCost: legacyTotal, materialCost: null, laborCost: null, expenseCost: null }];
    } else {
      const totals: number[] = [];
      for (const br of bidRequests) {
        for (const rb of br.receivedBids) {
          const s = rb.items.reduce((a, ri) => a + (ri.totalCost ?? 0), 0);
          if (s > 0) totals.push(s);
        }
      }
      if (totals.length > 0) {
        competitorBids = [{ id: 0, companyName: null, totalCost: Math.min(...totals), materialCost: null, laborCost: null, expenseCost: null }];
      }
    }
  }

  const sumBySource = (src: "price" | "wage"): number | null => {
    const rows = items.filter((it) => it.matchedSource === src && it.marketPrice != null);
    if (rows.length === 0) return null;
    return rows.reduce((a, it) => a + (it.marketPrice ?? 0) * (it.quantity ?? 1), 0);
  };
  const itemMarketBreakdown = {
    materialCost: sumBySource("price"),
    laborCost: sumBySource("wage"),
    expenseCost: null as number | null,
  };

  const quotationName =
    typeof meta?.projectName === "string" ? meta.projectName : null;
  const quotationSpec =
    typeof meta?.spec === "string" ? meta.spec : null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">04. 결과 확정 / 연동</h1>
        <p className="text-sm text-slate-500 mt-1">
          검토 결과를 확정하고 작업지시서를 생성하거나 외부 시스템과 연동합니다.
        </p>
      </header>

      <StepIndicator activeStep={4} quotationId={qid} />

      {/* 탭 — 분석 데이터 유지 */}
      <AnalyzePageClient
        quotation={{
          id: quotation.id,
          fileName: quotation.fileName,
          uploadedAt: quotation.uploadedAt.toISOString(),
          status: quotation.status,
          aiCommentary: quotation.aiCommentary,
          aiCommentaryAt: quotation.aiCommentaryAt?.toISOString() ?? null,
        }}
        meta={meta}
        partnerTotal={partnerTotal}
        partnerCostBreakdown={partnerCostBreakdown}
        priceSummary={
          quotation.priceSummary
            ? {
                id: quotation.priceSummary.id,
                name: quotation.priceSummary.name,
                spec: quotation.priceSummary.spec,
                unit: quotation.priceSummary.unit,
                totalCost: quotation.priceSummary.totalCost,
                materialCost: quotation.priceSummary.materialCost,
                laborCost: quotation.priceSummary.laborCost,
                expenseCost: quotation.priceSummary.expenseCost,
                sourceFile: quotation.priceSummary.sourceFile,
                sourceVia: quotation.priceSummary.sourceVia,
              }
            : null
        }
        confItems={items.map((it) => ({
          id: it.id,
          rowIndex: it.rowIndex,
          itemName: it.itemName,
          spec: it.spec,
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          confUnitPrice: it.confUnitPrice,
          matchedConfidence: it.matchedConfidence,
          deviationPct: it.deviationPct,
        }))}
        confTotal={confTotal}
        confMatchedCount={confMatched.length}
        competitorBids={competitorBids}
        itemMarketTotal={itemMarketTotal}
        itemMarketBreakdown={itemMarketBreakdown}
        itemTotalCount={items.length}
        itemMatchedCount={itemMatched.length}
        quotationName={quotationName}
        quotationSpec={quotationSpec}
        hideComparison
        matchedItems={items.map((it) => ({
          id: it.id,
          rowIndex: it.rowIndex,
          itemName: it.itemName,
          spec: it.spec,
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          matchedConfidence: it.matchedConfidence,
          marketPrice: it.marketPrice,
          marketRegion: it.marketRegion,
          deviationPct: it.deviationPct,
          matchedSource: (it.matchedSource ?? null) as "price" | "wage" | null,
          matchedPrice: it.matchedPrice
            ? { itemName: it.matchedPrice.itemName, spec: it.matchedPrice.spec, source: it.matchedPrice.source, region: it.matchedPrice.region }
            : null,
          matchedWage: it.matchedWage
            ? { jobName: it.matchedWage.jobName, cateCd: it.matchedWage.cateCd, source: it.matchedWage.wageRun?.source ?? "", unit: it.matchedWage.unit, basis: it.matchedWage.basis }
            : null,
        }))}
      />

      {/* 확정 영역 */}
      <div className="space-y-6 pt-2">
        <ReviewDecisionCard
          decisionLabel={decision.label}
          decisionTone={decision.tone}
          itemMarketTotal={itemMarketTotal}
          itemCount={itemCount}
          matchedCount={matchedCount}
          matchRate={matchRate}
          avgDev={avgDev}
          overCount={overCount}
          underCount={underCount}
        />

        <NewPriceReviewForm
          quotationFileName={quotation.fileName}
          quotationItems={items.map((it) => ({
            itemName: it.itemName,
            spec: it.spec,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
            marketPrice: it.marketPrice,
          }))}
          dbTotal={confTotal}
          actualSummary={
            quotation.priceSummary
              ? {
                  name: quotation.priceSummary.name,
                  totalCost: quotation.priceSummary.totalCost,
                  materialCost: quotation.priceSummary.materialCost,
                  laborCost: quotation.priceSummary.laborCost,
                  expenseCost: quotation.priceSummary.expenseCost,
                }
              : null
          }
          competitorBids={competitorBids}
        />

        <ConfirmAndOrderSection
          quotationId={quotation.id}
          status={quotation.status}
        />
      </div>

      <div className="flex justify-between pb-4">
        <Link
          href={`/analyze/${quotation.id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft size={16} /> AI 자동 분석으로
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded text-sm font-medium"
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  );
}
