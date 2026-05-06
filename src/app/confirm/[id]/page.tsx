import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StepIndicator } from "@/components/StepIndicator";
import { QuoteSummary } from "@/components/QuoteSummary";
import { ConfirmAndOrderSection } from "@/components/ConfirmAndOrderSection";
import { ReviewDecisionCard } from "@/components/ReviewDecisionCard";

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
  const itemCount = items.length;
  const matchedCount = items.filter(
    (it) => it.matchedPriceId != null
  ).length;
  const matchRate = itemCount > 0 ? matchedCount / itemCount : 0;

  const devs = items
    .map((it) => it.deviationPct)
    .filter((d): d is number => d != null);
  const avgDev =
    devs.length > 0 ? devs.reduce((a, b) => a + b, 0) / devs.length : null;
  const overCount = devs.filter((d) => d > 10).length;
  const underCount = devs.filter((d) => d < -10).length;

  // AI 매칭 단가 합계: 매칭된 행의 시장단가 × 수량 합산 (review 페이지의 itemMarketTotal 과 동일 로직)
  const itemMatched = items.filter((it) => it.marketPrice != null);
  const itemMarketTotal =
    itemMatched.length > 0
      ? itemMatched.reduce(
          (a, it) => a + (it.marketPrice ?? 0) * (it.quantity ?? 1),
          0
        )
      : null;

  const decision: { label: string; tone: "slate" | "rose" | "blue" | "emerald" } =
    matchRate < 0.5
      ? { label: "검토 필요", tone: "slate" }
      : overCount * 2 > itemCount || (avgDev != null && avgDev > 10)
        ? { label: "협상 권고", tone: "rose" }
        : underCount * 2 > itemCount || (avgDev != null && avgDev < -10)
          ? { label: "재확인 권고", tone: "blue" }
          : { label: "적정 단가", tone: "emerald" };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">
          04. 결과 확정 / 연동
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          검토 결과를 확정하고 작업지시서를 생성하거나 외부 시스템과 연동합니다.
        </p>
      </header>

      <StepIndicator activeStep={4} />

      <QuoteSummary
        quotation={{
          id: quotation.id,
          fileName: quotation.fileName,
          uploadedAt: quotation.uploadedAt,
          status: quotation.status,
        }}
        meta={meta}
      />

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

      <ConfirmAndOrderSection
        quotationId={quotation.id}
        status={quotation.status}
      />

      <div className="flex justify-between pb-4">
        <Link
          href={`/review/${quotation.id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft size={16} /> 검토 결과로 돌아가기
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
