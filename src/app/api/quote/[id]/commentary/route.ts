import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SYSTEM_PROMPT = `당신은 건축 자재 단가 분석 전문가입니다.
주어진 견적의 (1) 모든 라인 아이템과 시장 단가 매칭 결과, (2) 협력사 합계 vs
외부 단가 자료(PriceSummary) 합계 vs 세부 항목별 시장단가 합계 — 세 가지를
종합 평가해 한국어로 6~8문장의 보고서 톤 코멘트를 작성하세요.

작성 가이드:
- 첫 문장: 전체 견적의 가격 적정성 한 줄 요약
- 시장 대비 비싼 항목(편차 +10% 이상) / 저렴한 항목(-10% 이하) 을 구체적으로 지목
- 매칭 신뢰도 0.5 미만 또는 매칭 실패 항목이 있으면 검증 필요 명시
- 외부 단가 자료가 선택되어 있으면:
  · 협력사 합계 vs 매칭 자료 합계의 편차를 평가
  · 재료비/노무비/경비 항목별 편차도 한 줄로 짚어주기
- 세부 항목별 시장단가 합계가 산출되면:
  · 협력사 합계 vs 세부 합계의 편차를 평가
  · 매칭 자료 합계와 세부 합계가 서로 어긋나면 어떤 쪽이 더 신뢰할 만한지 판단
- 두 비교가 모두 가능하면:
  · **적정 합계 범위** 를 두 합계의 보수적/중간값을 활용해 권장
    (예: "두 비교를 종합한 적정 합계 범위는 약 4,750,000원 ~ 5,250,000원 으로
    판단됩니다")
- 외부 단가 자료도 세부 합계도 없으면 합계 평가는 생략하고 항목별 평가만
- 마지막: 협상 / 재확인 / 발주 진행 등 다음 액션 권고

말투: 간결한 보고서. 인사·서론·결론 마무리 없이 본문만.`;

interface ItemLine {
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  marketPrice: number | null;
  marketRegion: string | null;
  deviationPct: number | null;
  matchedConfidence: number | null;
  matchedPrice: {
    itemName: string;
    spec: string | null;
    source: string;
  } | null;
}

function lineSummary(it: ItemLine, idx: number): string {
  const parts: string[] = [
    `${String(idx + 1).padStart(2, "0")}. ${it.itemName}`,
  ];
  if (it.spec) parts.push(`(${it.spec})`);
  if (it.unit) parts.push(`/ ${it.unit}`);
  if (it.quantity != null) parts.push(`/ 수량 ${it.quantity}`);
  if (it.unitPrice != null)
    parts.push(`/ 협력사 ${it.unitPrice.toLocaleString()}원`);

  const matchPart = it.matchedPrice
    ? `매칭=${it.matchedPrice.itemName}${
        it.matchedPrice.spec ? ` (${it.matchedPrice.spec})` : ""
      } [${it.matchedPrice.source}]`
    : "매칭 실패";
  const marketPart =
    it.marketPrice != null
      ? `시장 ${it.marketPrice.toLocaleString()}원${
          it.marketRegion ? ` (${it.marketRegion})` : ""
        }`
      : "시장 단가 없음";
  const devPart =
    it.deviationPct != null
      ? `편차 ${it.deviationPct > 0 ? "+" : ""}${it.deviationPct.toFixed(1)}%`
      : "편차 N/A";
  const confPart =
    it.matchedConfidence != null
      ? `신뢰도 ${(it.matchedConfidence * 100).toFixed(0)}%`
      : "신뢰도 N/A";

  return [
    parts.join(" "),
    `   → ${matchPart} / ${marketPart} / ${devPart} / ${confPart}`,
  ].join("\n");
}

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

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const qid = Number(id);
  if (!Number.isFinite(qid) || qid <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id: qid },
    include: {
      items: {
        orderBy: { rowIndex: "asc" },
        include: { matchedPrice: true },
      },
      priceSummary: true,
    },
  });
  if (!quotation) return new Response("not found", { status: 404 });
  if (quotation.items.length === 0) {
    return new Response("no items", { status: 400 });
  }

  const meta =
    typeof quotation.rawResponse === "object" &&
    quotation.rawResponse !== null &&
    !Array.isArray(quotation.rawResponse)
      ? (quotation.rawResponse as Record<string, unknown>)
      : null;

  const headerLines = [
    `[견적 정보 — 총 ${quotation.items.length}건]`,
    typeof meta?.projectName === "string" && meta.projectName
      ? `공사명: ${meta.projectName}`
      : null,
    typeof meta?.spec === "string" && meta.spec
      ? `규격: ${meta.spec}`
      : null,
    typeof meta?.workType === "string" && meta.workType
      ? `공종: ${meta.workType}`
      : null,
    typeof meta?.reviewReason === "string" && meta.reviewReason
      ? `검토 사유: ${meta.reviewReason}`
      : null,
  ].filter((l): l is string => l !== null);

  const itemLines = quotation.items.map((it, idx) =>
    lineSummary(
      {
        rowIndex: it.rowIndex,
        itemName: it.itemName,
        spec: it.spec,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        marketPrice: it.marketPrice,
        marketRegion: it.marketRegion,
        deviationPct: it.deviationPct,
        matchedConfidence: it.matchedConfidence,
        matchedPrice: it.matchedPrice
          ? {
              itemName: it.matchedPrice.itemName,
              spec: it.matchedPrice.spec,
              source: it.matchedPrice.source,
            }
          : null,
      },
      idx
    )
  );

  const partnerTotal =
    num(meta?.partnerPrice) ??
    (quotation.items.reduce((a, it) => a + (it.totalPrice ?? 0), 0) || null);
  const partnerMaterial = num(meta?.materialCost);
  const partnerLabor = num(meta?.laborCost);
  const partnerExpense = num(meta?.expenseCost);

  const matchedCount = quotation.items.filter(
    (it) => it.matchedPriceId != null
  ).length;
  const overCount = quotation.items.filter(
    (it) => it.deviationPct != null && it.deviationPct > 10
  ).length;
  const underCount = quotation.items.filter(
    (it) => it.deviationPct != null && it.deviationPct < -10
  ).length;

  const itemSummaryLine = [
    `총 견적 합계: ${(partnerTotal ?? 0).toLocaleString()}원`,
    `매칭 ${matchedCount}/${quotation.items.length}건`,
    `시장 대비 비쌈 ${overCount}건 / 저렴 ${underCount}건`,
  ].join(" · ");

  // 세부 항목별 시장단가 합계 (매칭된 행만)
  const itemMatched = quotation.items.filter((it) => it.marketPrice != null);
  const itemMarketTotal =
    itemMatched.length > 0
      ? itemMatched.reduce((a, it) => {
          const qty = it.quantity ?? 1;
          return a + (it.marketPrice ?? 0) * qty;
        }, 0)
      : null;

  // 합계 비교 블록
  const summary = quotation.priceSummary;
  const totalBlock: string[] = [];
  if (summary) {
    totalBlock.push("");
    totalBlock.push("[단가 합계 매칭 자료]");
    totalBlock.push(
      `- 명칭: ${summary.name}${summary.spec ? ` / ${summary.spec}` : ""}${summary.unit ? ` / ${summary.unit}` : ""}`
    );
    totalBlock.push(
      `- 매칭 자료 합계: ${summary.totalCost != null ? summary.totalCost.toLocaleString() + "원" : "N/A"}` +
        (summary.materialCost != null
          ? ` (재료비 ${summary.materialCost.toLocaleString()}원`
          : "") +
        (summary.laborCost != null
          ? `, 노무비 ${summary.laborCost.toLocaleString()}원`
          : "") +
        (summary.expenseCost != null
          ? `, 경비 ${summary.expenseCost.toLocaleString()}원)`
          : summary.materialCost != null
            ? ")"
            : "")
    );
    totalBlock.push(
      `- 협력사 합계: ${partnerTotal != null ? partnerTotal.toLocaleString() + "원" : "N/A"}` +
        (partnerMaterial != null
          ? ` (재료비 ${partnerMaterial.toLocaleString()}원`
          : "") +
        (partnerLabor != null
          ? `, 노무비 ${partnerLabor.toLocaleString()}원`
          : "") +
        (partnerExpense != null
          ? `, 경비 ${partnerExpense.toLocaleString()}원)`
          : partnerMaterial != null
            ? ")"
            : "")
    );
    if (
      partnerTotal != null &&
      summary.totalCost != null &&
      summary.totalCost !== 0
    ) {
      const dev =
        ((partnerTotal - summary.totalCost) / summary.totalCost) * 100;
      totalBlock.push(
        `- 협력사 vs 매칭자료 편차: ${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`
      );
    }
  } else {
    totalBlock.push("");
    totalBlock.push(
      "[단가 합계 매칭 자료] 선택되지 않음 — 매칭 자료 합계 평가는 생략."
    );
  }

  totalBlock.push("");
  if (itemMarketTotal != null) {
    totalBlock.push("[세부 항목별 시장단가 합계]");
    totalBlock.push(
      `- 매칭된 ${itemMatched.length}/${quotation.items.length}건의 시장단가 × 수량 합산: ${itemMarketTotal.toLocaleString()}원`
    );
    if (partnerTotal != null && itemMarketTotal !== 0) {
      const dev = ((partnerTotal - itemMarketTotal) / itemMarketTotal) * 100;
      totalBlock.push(
        `- 협력사 vs 세부합계 편차: ${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`
      );
    }
  } else {
    totalBlock.push(
      "[세부 항목별 시장단가 합계] 매칭된 항목이 없어 산출 불가."
    );
  }

  const userMsg = [
    headerLines.join("\n"),
    "",
    "[라인 아이템]",
    itemLines.join("\n"),
    "",
    `[항목 요약] ${itemSummaryLine}`,
    ...totalBlock,
  ].join("\n");

  const client = getOpenAIClient();
  const stream = await client.chat.completions.create({
    model: "gpt-4o",
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let accumulated = "";
      try {
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content;
          if (t) {
            accumulated += t;
            controller.enqueue(encoder.encode(t));
          }
        }
        if (accumulated.trim() !== "") {
          await prisma.quotation.update({
            where: { id: qid },
            data: {
              aiCommentary: accumulated,
              aiCommentaryAt: new Date(),
            },
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[ERROR] ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
