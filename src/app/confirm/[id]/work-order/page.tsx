import { randomBytes } from "crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { WorkOrderForm } from "@/components/WorkOrderForm";
import { ApprovalRequestButton } from "@/components/ApprovalRequestButton";

export const dynamic = "force-dynamic";

const DOC_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function genDocNumber(): string {
  const buf = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += DOC_CHARS[buf[i] % DOC_CHARS.length];
  return out;
}

// 사이드바의 현재 사용자와 동기화 (Sidebar.tsx 의 CURRENT_USER 와 동일)
const CURRENT_USER_NAME = "박현우";

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
    include: {
      items: { orderBy: { rowIndex: "asc" } },
      priceSummary: { select: { name: true } },
    },
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

  // 오늘 날짜 (YYYY-MM-DD)
  const today = new Date().toISOString().slice(0, 10);

  // 대표수량/단가: 항목별 수량 × 단가 요약
  const topItems = quotation.items.slice(0, 8);
  const representativeQty =
    topItems.length > 0
      ? topItems
          .map((it) => {
            const parts = [it.itemName];
            if (it.spec) parts.push(it.spec);
            if (it.quantity) parts.push(`${it.quantity}${it.unit ?? ""}`);
            if (it.unitPrice)
              parts.push(`@ ${Math.round(it.unitPrice).toLocaleString()}원`);
            if (it.totalPrice)
              parts.push(`= ${Math.round(it.totalPrice).toLocaleString()}원`);
            return parts.join(" · ");
          })
          .join("\n")
      : "";

  // 협력사명: 견적서 엑셀(시트1) 추출 시 meta.partnerName 에 저장됨
  const contractName =
    typeof meta?.partnerName === "string" ? meta.partnerName : "";

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-5">
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
            Quotation #{quotation.id} · {projectName || quotation.fileName}
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
        initialRepresentativeQty={representativeQty}
        initialIssueDate={today}
        initialContractName={contractName}
        initialDocNumber={genDocNumber()}
        initialIssuer={CURRENT_USER_NAME}
      />
    </div>
  );
}
