import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { WorkOrderForm } from "@/components/WorkOrderForm";
import { ApprovalRequestButton } from "@/components/ApprovalRequestButton";

export const dynamic = "force-dynamic";

export default async function WorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const qid = Number(id);
  if (!Number.isFinite(qid) || qid <= 0) notFound();

  const quotation = await prisma.quotation.findUnique({
    where: { id: qid },
    include: { items: true },
  });
  if (!quotation) notFound();

  const meta =
    typeof quotation.rawResponse === "object" &&
    quotation.rawResponse !== null &&
    !Array.isArray(quotation.rawResponse)
      ? (quotation.rawResponse as Record<string, unknown>)
      : null;

  const projectName =
    typeof meta?.projectName === "string" ? meta.projectName : "";
  const totalQuotedPrice = quotation.items.reduce(
    (a, it) => a + (it.totalPrice ?? 0),
    0
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/confirm/${quotation.id}`}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-2"
          >
            <ChevronLeft size={14} /> 결과 확정으로 돌아가기
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">작업지시서 생성</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quotation #{quotation.id} ·{" "}
            {projectName || quotation.fileName}
          </p>
        </div>
        <ApprovalRequestButton
          quotationId={quotation.id}
          status={quotation.status}
        />
      </header>

      <WorkOrderForm
        initialProjectName={projectName}
        initialAmount={totalQuotedPrice > 0 ? totalQuotedPrice : null}
        initialTitle={projectName ? `${projectName} 작업지시서` : ""}
      />
    </div>
  );
}
