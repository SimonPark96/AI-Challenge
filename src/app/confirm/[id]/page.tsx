import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CheckCircle2, FileSpreadsheet, Send } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StepIndicator } from "@/components/StepIndicator";
import { QuoteSummary } from "@/components/QuoteSummary";
import { ConfirmAction } from "@/components/ConfirmAction";

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

  const totalQuotedPrice = items.reduce(
    (a, it) => a + (it.totalPrice ?? 0),
    0
  );

  const decision: { label: string; tone: "slate" | "rose" | "blue" | "emerald" } =
    matchRate < 0.5
      ? { label: "검토 필요", tone: "slate" }
      : overCount * 2 > itemCount || (avgDev != null && avgDev > 10)
        ? { label: "협상 권고", tone: "rose" }
        : underCount * 2 > itemCount || (avgDev != null && avgDev < -10)
          ? { label: "재확인 권고", tone: "blue" }
          : { label: "적정 단가", tone: "emerald" };

  const toneCls = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  }[decision.tone];

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

      <section className={`rounded-lg border p-6 ${toneCls}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 size={18} />
          AI 검토 판정 — {decision.label}
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Stat label="항목 수" value={`${itemCount}건`} />
          <Stat
            label="총 견적가"
            value={
              totalQuotedPrice > 0
                ? totalQuotedPrice.toLocaleString() + "원"
                : "-"
            }
          />
          <Stat
            label="평균 편차"
            value={
              avgDev != null
                ? `${avgDev > 0 ? "+" : ""}${avgDev.toFixed(1)}%`
                : "-"
            }
          />
          <Stat
            label="매칭률"
            value={
              itemCount > 0
                ? `${(matchRate * 100).toFixed(0)}% (${matchedCount}/${itemCount})`
                : "-"
            }
          />
        </div>
        {(overCount > 0 || underCount > 0) && (
          <div className="mt-3 text-xs">
            시장 대비 비쌈 <span className="font-semibold">{overCount}건</span>
            {" · "}저렴 <span className="font-semibold">{underCount}건</span>
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800">
          확정 / 외부 연동
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          외부 시스템 연동은 추후 단계에서 구현 예정입니다.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <ConfirmAction
            quotationId={quotation.id}
            status={quotation.status}
          />
          <ActionCard
            icon={<FileSpreadsheet size={16} />}
            title="작업지시서 생성"
            desc="확정된 단가로 작업지시서 PDF/XLSX 출력"
            disabled
          />
          <ActionCard
            icon={<Send size={16} />}
            title="외부 시스템 전송"
            desc="ERP / 회계 시스템 연동 (추후 구현)"
            disabled
          />
        </div>
      </section>

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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className="text-left border border-slate-200 rounded p-4 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition"
    >
      <div className="flex items-center gap-2 text-slate-800 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">
        {desc}
      </div>
    </button>
  );
}
