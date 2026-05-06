import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EMPTY_MATCH,
  isMatchExcluded,
  matchToMarketPrice,
} from "@/lib/quote/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface AnalyzeItem {
  itemName: string;
  spec?: string;
  unit?: string;
  quantity?: string;
  unitPrice?: string;
}

interface AnalyzeBody {
  form: {
    workType?: string;
    projectName?: string;
    spec?: string;
    reviewReason?: string;
    items: AnalyzeItem[];
    partnerPrice?: string;
    materialCost?: string;
    laborCost?: string;
    expenseCost?: string;
    notes?: string;
  };
  fileName?: string | null;
  fileSize?: number | null;
  priceSummaryId?: number | null;
}

function num(v: string | undefined | null): number | null {
  if (v == null) return null;
  const t = String(v).trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * /request 폼에서 호출. 다중 행 견적 검토.
 * 1) 각 row 에 대해 PriceHistory 매칭 (병렬)
 * 2) Quotation row + N개 QuotationItem cascade insert
 * 3) priceSummaryId 가 유효하면 연결
 * 4) quotationId 반환
 */
export async function POST(req: Request) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON" },
      { status: 400 }
    );
  }

  const rawItems = Array.isArray(body.form?.items) ? body.form.items : [];
  const validItems = rawItems.filter(
    (it) => typeof it?.itemName === "string" && it.itemName.trim() !== ""
  );
  if (validItems.length === 0) {
    return NextResponse.json(
      { error: "form.items 에 최소 1개의 품목이 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const matches = await Promise.all(
      validItems.map((it) => {
        const name = it.itemName.trim();
        // "장비비" 등은 매칭 대상 아님 — 빈 결과로 즉시 반환.
        if (isMatchExcluded(name)) return Promise.resolve(EMPTY_MATCH);
        return matchToMarketPrice(name, strOrNull(it.spec));
      })
    );

    const itemsData: Prisma.QuotationItemUncheckedCreateWithoutQuotationInput[] =
      validItems.map((it, idx) => {
        const itemName = it.itemName.trim();
        const spec = strOrNull(it.spec);
        const unit = strOrNull(it.unit);
        const quantity = num(it.quantity);
        const unitPrice = num(it.unitPrice);
        const totalPrice =
          unitPrice != null && quantity != null ? unitPrice * quantity : null;
        const m = matches[idx];
        const deviationPct =
          unitPrice !== null &&
          m.marketPrice !== null &&
          m.marketPrice !== 0
            ? ((unitPrice - m.marketPrice) / m.marketPrice) * 100
            : null;

        return {
          rowIndex: idx,
          itemName,
          spec,
          unit,
          quantity,
          unitPrice,
          totalPrice,
          matchedSource: m.source === "none" ? null : m.source,
          matchedPriceId: m.matchedPriceId,
          matchedWageId: m.matchedWageId,
          matchedConfidence: m.matchedConfidence,
          marketPrice: m.marketPrice,
          marketRegion: m.marketRegion,
          deviationPct,
        };
      });

    const meta: Prisma.InputJsonValue = {
      workType: body.form.workType ?? "",
      projectName: body.form.projectName ?? "",
      spec: body.form.spec ?? "",
      reviewReason: body.form.reviewReason ?? "",
      partnerPrice: num(body.form.partnerPrice),
      materialCost: num(body.form.materialCost),
      laborCost: num(body.form.laborCost),
      expenseCost: num(body.form.expenseCost),
      notes: body.form.notes ?? "",
      itemCount: validItems.length,
      matchedCount: matches.filter(
        (m) => m.matchedPriceId !== null || m.matchedWageId !== null
      ).length,
    };

    const summaryId =
      typeof body.priceSummaryId === "number" &&
      Number.isFinite(body.priceSummaryId) &&
      body.priceSummaryId > 0
        ? body.priceSummaryId
        : null;

    let validSummaryId: number | null = null;
    if (summaryId !== null) {
      const exists = await prisma.priceSummary.findUnique({
        where: { id: summaryId },
        select: { id: true },
      });
      validSummaryId = exists ? summaryId : null;
    }

    const quotation = await prisma.quotation.create({
      data: {
        fileName: body.fileName ?? `quote-${Date.now()}.manual`,
        fileSize: body.fileSize ?? 0,
        status: "compared",
        rawResponse: meta,
        priceSummaryId: validSummaryId,
        items: { create: itemsData },
      },
    });

    return NextResponse.json({
      quotationId: quotation.id,
      itemCount: validItems.length,
      matchedCount: matches.filter(
        (m) => m.matchedPriceId !== null || m.matchedWageId !== null
      ).length,
      priceSummaryId: validSummaryId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
