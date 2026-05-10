import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StepIndicator } from "@/components/StepIndicator";
import { AnalyzePageClient } from "@/components/AnalyzePageClient";

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

export default async function AnalyzeByIdPage({
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

  const partnerTotal =
    num(meta?.partnerPrice) ??
    (quotation.items.reduce((a, it) => a + (it.totalPrice ?? 0), 0) || null);

  const partnerCostBreakdown = {
    materialCost: num(meta?.materialCost),
    laborCost: num(meta?.laborCost),
    expenseCost: num(meta?.expenseCost),
  };

  const confMatched = quotation.items.filter((it) => it.confUnitPrice != null);
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
  const metaCompetitorBids = Array.isArray(meta?.competitorBids)
    ? (meta.competitorBids as CompetitorBidCol[])
    : [];

  if (metaCompetitorBids.length > 0) {
    competitorBids = metaCompetitorBids;
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

  const itemMatched = quotation.items.filter((it) => it.marketPrice != null);
  const itemMarketTotal =
    itemMatched.length > 0
      ? itemMatched.reduce((a, it) => a + (it.marketPrice ?? 0) * (it.quantity ?? 1), 0)
      : null;

  const sumBySource = (src: "price" | "wage"): number | null => {
    const rows = quotation.items.filter((it) => it.matchedSource === src && it.marketPrice != null);
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
        <h1 className="text-2xl font-bold text-slate-800">02. AI 자동 비교</h1>
        <p className="text-sm text-slate-500 mt-1">
          AI가 협력사 견적 항목을 시장단가·사내 DB·실적단가와 자동 매칭한 결과입니다.
        </p>
      </header>

      <StepIndicator activeStep={2} quotationId={qid} />

      <AnalyzePageClient
        forceInitialTab="db"
        showConfirmTrigger
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
        confItems={quotation.items.map((it) => ({
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
        itemTotalCount={quotation.items.length}
        itemMatchedCount={itemMatched.length}
        quotationName={quotationName}
        quotationSpec={quotationSpec}
        matchedItems={quotation.items.map((it) => ({
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

      <div className="flex justify-between pb-4">
        <Link
          href="/request"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft size={16} /> 다시 요청
        </Link>
      </div>
    </div>
  );
}
