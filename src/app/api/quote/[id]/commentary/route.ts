import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SYSTEM_PROMPT = `당신은 건설·자재 단가 검토 전문가입니다.
제공된 견적 데이터를 분석하여 반드시 아래 마크다운 형식으로 한국어 보고서를 작성하세요.
인사말·서론·맺음말 없이 섹션 본문만 출력합니다.

---

## 전체 적정성 요약
한두 문장으로 이 견적의 전반적인 가격 적정성을 평가합니다.
(예: "전체 견적은 시장 단가 대비 소폭 높은 수준이며, 일부 항목에서 협상 여지가 확인됩니다.")

## 항목별 단가 분석
- 시장 대비 **비싼 항목**(편차 +10% 이상)을 제목으로 하고 볼드체로 적용. 그 하위에 새로운 뎁스로 항목명과 편차(%)와 함께 구체적으로 나열합니다.
- 시장 대비 **저렴한 항목**(편차 -10% 이하)을 제목으로 하고 볼드체 적용. 그 하위에 새로운 뎁스로 항목명과 편차(%)와 함께 구체적으로 나열합니다.
- 매칭 신뢰도 50% 미만 또는 매칭 실패 항목은 항목명과 함께 "검증 필요"로 명시하고 볼드체 적용.
- 특이사항 없으면 한 줄로 "모든 항목이 시장 단가 적정 범위 내에 있습니다." 라고 씁니다.

## 단가 합계 비교
(사내 DB 단가 또는 AI 매칭 단가 합계 데이터가 있을 때만 이 섹션을 작성합니다. 둘 다 없으면 생략.)
- 협력사 견적 vs 사내 DB 단가 편차 평가 및 재료비·노무비·경비 항목별 편차를 한 줄씩 씁니다.
- 협력사 견적 vs AI 매칭 단가 합계 편차를 평가합니다.
- 두 비교가 모두 가능하면 적정 합계 범위를 구체적인 금액(원)으로 제시합니다.
  (예: "두 단가를 종합한 **적정 합계 범위는 약 4,750,000원 ~ 5,250,000원** 으로 판단됩니다.")
- 두 비교 단가가 서로 상충하면 어느 쪽이 더 신뢰할 만한지 이유와 함께 판단합니다.

## AI 최적 단가 추천
이 섹션은 반드시 작성합니다. 아래 규칙에 따라 가장 적합한 단가 기준을 선정하고 이유를 2~3문장으로 설명합니다.

선정 기준:
1. 사내 DB 단가·AI 매칭 단가·3사 견적 단가 중 협력사 견적보다 낮은 단가가 있으면
   → 그 중 절감 효과가 가장 큰 단가를 **협상 기준가**로 추천합니다.
   → 절감 예상 금액(원)을 구체적으로 명시합니다.
2. 모든 비교 단가가 협력사 견적보다 높으면
   → 협력사 단가가 경쟁력 있다고 평가하고 발주 진행을 권장합니다.
3. 비교 단가가 없으면
   → 추가 데이터(3사 견적 수령·사내 DB 매칭 등) 수집 후 재분석을 권장합니다.

출력 형식:
**추천 기준가: [단가 종류] (협력사 대비 [±X.X%])**
[추천 이유 2~3문장. 절감 금액 또는 발주 근거 포함.]
[다음 액션 한 문장.]

---

말투: 간결한 보고서 어조. 수치는 소수점 1자리까지. **강조**는 핵심 금액·단가명에만 사용.`;

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
    typeof meta?.spec === "string" && meta.spec ? `규격: ${meta.spec}` : null,
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
  const lowConfCount = quotation.items.filter(
    (it) => it.matchedConfidence != null && it.matchedConfidence < 0.5
  ).length;

  const itemSummaryLine = [
    `총 견적 합계: ${(partnerTotal ?? 0).toLocaleString()}원`,
    `매칭 ${matchedCount}/${quotation.items.length}건`,
    `시장 대비 비쌈 ${overCount}건 / 저렴 ${underCount}건`,
    `저신뢰도(50% 미만) ${lowConfCount}건`,
  ].join(" · ");

  // AI 매칭 단가 합계
  const itemMatched = quotation.items.filter((it) => it.marketPrice != null);
  const itemMarketTotal =
    itemMatched.length > 0
      ? itemMatched.reduce((a, it) => {
          const qty = it.quantity ?? 1;
          return a + (it.marketPrice ?? 0) * qty;
        }, 0)
      : null;

  // 합계 비교 블록 — AI가 각 단가 간 편차를 정확히 파악할 수 있도록 구체적 수치 제공
  const summary = quotation.priceSummary;
  const totalBlock: string[] = [];

  if (summary) {
    totalBlock.push("");
    totalBlock.push("[사내 DB 단가 (실적 단가)]");
    totalBlock.push(
      `- 명칭: ${summary.name}${summary.spec ? ` / ${summary.spec}` : ""}${
        summary.unit ? ` / ${summary.unit}` : ""
      }`
    );
    totalBlock.push(
      `- 사내 DB 합계: ${
        summary.totalCost != null
          ? summary.totalCost.toLocaleString() + "원"
          : "N/A"
      }` +
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
      `- 협력사 견적 합계: ${
        partnerTotal != null ? partnerTotal.toLocaleString() + "원" : "N/A"
      }` +
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
      const saving = partnerTotal - summary.totalCost;
      totalBlock.push(
        `- 협력사 vs 사내 DB 편차: ${dev > 0 ? "+" : ""}${dev.toFixed(
          1
        )}% (협력사가 ${Math.abs(saving).toLocaleString()}원 ${
          saving > 0 ? "더 비쌈" : "더 저렴"
        })`
      );
    }
  } else {
    totalBlock.push("");
    totalBlock.push("[사내 DB 단가] 선택되지 않음 — 사내 DB 단가 비교 생략.");
  }

  totalBlock.push("");
  if (itemMarketTotal != null) {
    totalBlock.push("[AI 매칭 단가 합계]");
    totalBlock.push(
      `- 매칭된 ${itemMatched.length}/${
        quotation.items.length
      }건의 시장단가 × 수량 합산: ${itemMarketTotal.toLocaleString()}원`
    );
    if (partnerTotal != null && itemMarketTotal !== 0) {
      const dev = ((partnerTotal - itemMarketTotal) / itemMarketTotal) * 100;
      const saving = partnerTotal - itemMarketTotal;
      totalBlock.push(
        `- 협력사 vs AI 매칭 편차: ${dev > 0 ? "+" : ""}${dev.toFixed(
          1
        )}% (협력사가 ${Math.abs(saving).toLocaleString()}원 ${
          saving > 0 ? "더 비쌈" : "더 저렴"
        })`
      );
    }
  } else {
    totalBlock.push(
      "[AI 매칭 단가 합계] 매칭된 항목 없음 — AI 매칭 단가 비교 생략."
    );
  }

  // 최적 단가 판단에 필요한 요약 힌트 제공
  const hintLines: string[] = [];
  hintLines.push("");
  hintLines.push("[단가 비교 요약 — AI 최적 단가 추천 판단용]");
  const refs = [
    summary?.totalCost != null && partnerTotal != null
      ? {
          label: "사내 DB 단가",
          total: summary.totalCost,
          dev: ((summary.totalCost - partnerTotal) / partnerTotal) * 100,
        }
      : null,
    itemMarketTotal != null && partnerTotal != null
      ? {
          label: "AI 매칭 단가",
          total: itemMarketTotal,
          dev: ((itemMarketTotal - partnerTotal) / partnerTotal) * 100,
        }
      : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  if (refs.length > 0) {
    refs.forEach((r) => {
      hintLines.push(
        `- ${r.label}: ${r.total.toLocaleString()}원 / 협력사 대비 ${
          r.dev > 0 ? "+" : ""
        }${r.dev.toFixed(1)}% (${
          r.dev < 0
            ? "협력사보다 저렴 → 절감 가능"
            : "협력사보다 비쌈 → 협력사 경쟁력 있음"
        })`
      );
    });
    const cheapest = refs
      .filter((r) => r.dev < 0)
      .sort((a, b) => a.dev - b.dev)[0];
    if (cheapest) {
      const saving = (partnerTotal ?? 0) - cheapest.total;
      hintLines.push(
        `- 가장 절감 효과 큰 단가: ${cheapest.label} (${Math.abs(
          cheapest.dev
        ).toFixed(1)}% 절감, 약 ${saving.toLocaleString()}원 차이)`
      );
    }
  } else {
    hintLines.push("- 비교 가능한 합계 단가 없음.");
  }

  const userMsg = [
    headerLines.join("\n"),
    "",
    "[라인 아이템]",
    itemLines.join("\n"),
    "",
    `[항목 요약] ${itemSummaryLine}`,
    ...totalBlock,
    ...hintLines,
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
