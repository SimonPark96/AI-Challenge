import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StepIndicator } from "@/components/StepIndicator";
import { QuoteSummary } from "@/components/QuoteSummary";
import { ComparisonTable } from "@/components/ComparisonTable";
import { TotalComparison } from "@/components/TotalComparison";
import { AICommentary } from "@/components/AICommentary";
import { AiChatBot } from "@/components/chat/AiChatBot";

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

export default async function ReviewByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const qid = Number(id);
  if (!Number.isFinite(qid) || qid <= 0) notFound();

  const quotation = await prisma.quotation.findUnique({
    where: { id: qid },
    include: {
      items: {
        orderBy: { rowIndex: "asc" },
        include: { matchedPrice: true, matchedWage: true },
      },
      priceSummary: true,
    },
  });
  if (!quotation) notFound();

  const meta =
    typeof quotation.rawResponse === "object" &&
    quotation.rawResponse !== null &&
    !Array.isArray(quotation.rawResponse)
      ? (quotation.rawResponse as Record<string, unknown>)
      : null;

  const items = quotation.items.map((it) => ({
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
      ? {
          itemName: it.matchedPrice.itemName,
          spec: it.matchedPrice.spec,
          source: it.matchedPrice.source,
          region: it.matchedPrice.region,
        }
      : null,
    matchedWage: it.matchedWage
      ? {
          jobName: it.matchedWage.jobName,
          cateCd: it.matchedWage.cateCd,
          source: it.matchedWage.source,
          unit: it.matchedWage.unit,
          basis: it.matchedWage.basis,
        }
      : null,
  }));

  const partnerTotal =
    num(meta?.partnerPrice) ??
    (quotation.items.reduce((a, it) => a + (it.totalPrice ?? 0), 0) || null);

  const partnerCostBreakdown = {
    materialCost: num(meta?.materialCost),
    laborCost: num(meta?.laborCost),
    expenseCost: num(meta?.expenseCost),
  };

  // AI 매칭 단가 합계: 각 라인의 시장단가 × 수량 합산 (매칭된 행만)
  const itemMatched = quotation.items.filter((it) => it.marketPrice != null);
  const itemMarketTotal =
    itemMatched.length > 0
      ? itemMatched.reduce((a, it) => {
          const qty = it.quantity ?? 1;
          return a + (it.marketPrice ?? 0) * qty;
        }, 0)
      : null;

  // 매칭 source 별 분해 — 자재(price) → 재료비, 노임(wage) → 노무비, 경비는 라인 아이템에서 도출 불가.
  const sumByMatchedSource = (src: "price" | "wage"): number | null => {
    const rows = quotation.items.filter(
      (it) => it.matchedSource === src && it.marketPrice != null
    );
    if (rows.length === 0) return null;
    return rows.reduce(
      (a, it) => a + (it.marketPrice ?? 0) * (it.quantity ?? 1),
      0
    );
  };
  const itemMarketBreakdown = {
    materialCost: sumByMatchedSource("price"),
    laborCost: sumByMatchedSource("wage"),
    expenseCost: null as number | null,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">
          03. 적정 단가 검토
        </h1>
      </header>

      <StepIndicator activeStep={3} />

      <QuoteSummary
        quotation={{
          id: quotation.id,
          fileName: quotation.fileName,
          uploadedAt: quotation.uploadedAt,
          status: quotation.status,
        }}
        meta={meta}
      />

      <TotalComparison
        partnerTotal={partnerTotal}
        partnerCostBreakdown={partnerCostBreakdown}
        summary={
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
        itemMarketTotal={itemMarketTotal}
        itemMarketBreakdown={itemMarketBreakdown}
        itemTotalCount={quotation.items.length}
        itemMatchedCount={itemMatched.length}
      />

      <ComparisonTable quotationId={quotation.id} items={items} />

      {items.length > 0 && (
        <AICommentary
          quotationId={quotation.id}
          initialCommentary={quotation.aiCommentary}
          initialCommentaryAt={quotation.aiCommentaryAt}
        />
      )}

      <div className="flex justify-between pb-4">
        <Link
          href="/request"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft size={16} /> 다시 요청
        </Link>
        <Link
          href={`/confirm/${quotation.id}`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded text-sm font-medium"
        >
          결과 확정 <ChevronRight size={16} />
        </Link>
      </div>

      <AiChatBot mode="review" quotationId={quotation.id} />
    </div>
  );
}
