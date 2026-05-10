import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StepIndicator } from "@/components/StepIndicator";
import { QuoteSummary } from "@/components/QuoteSummary";
import { ReviewDecisionCard } from "@/components/ReviewDecisionCard";
import { NewPriceReviewForm } from "@/components/NewPriceReviewForm";
import { ConfirmAndOrderSection } from "@/components/ConfirmAndOrderSection";
import { AiChatBot } from "@/components/chat/AiChatBot";

export const dynamic = "force-dynamic";

export default async function ConfirmByIdPage({
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
  const competitorBids: CompetitorBidCol[] = Array.isArray(meta?.competitorBids)
    ? (meta.competitorBids as CompetitorBidCol[])
    : [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">03. 결과 확정 / 연동</h1>
        <p className="text-sm text-slate-500 mt-1">
          검토 결과를 확정하고 작업지시서를 생성하거나 외부 시스템과 연동합니다.
        </p>
      </header>

      <StepIndicator activeStep={3} quotationId={qid} />

      <QuoteSummary
        quotation={{
          id: quotation.id,
          fileName: quotation.fileName,
          uploadedAt: quotation.uploadedAt.toISOString(),
          status: quotation.status,
        }}
        meta={meta}
      />

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
          <ChevronLeft size={16} /> AI 자동 비교로
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded text-sm font-medium"
        >
          검토 요청 목록으로 이동
        </Link>
      </div>

      <AiChatBot mode="review" quotationId={qid} />
    </div>
  );
}
