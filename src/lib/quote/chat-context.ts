import { prisma } from "../prisma";

const WAGE_CATE_LABELS: Record<string, string> = {
  "701111": "공사부문",
  "701115": "기타직종",
};

function ymd(d: Date | null | undefined): string {
  if (!d) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

const SYSTEM_INSTRUCTIONS = `당신은 건축 자재/노임 단가 검토 어시스턴트입니다.
이 견적의 매칭 결과를 검토하는 사용자와 짧게 대화하며 돕습니다.

응답 스타일:
- 한국어. 간결하고 자연스럽게. 불필요한 인사·면책·재진술 없이 본론.
- 짧은 티키타카는 OK. 단, 도메인(단가 검토 / 건축 자재·노임 / 견적 협상) 안에서만.

답변은 질문 성격에 따라 두 모드를 자연스럽게 섞어 사용하세요.

【사실 조회】 — "이 견적의 어떤 값" 을 묻는 질문
  예: "2번 라인 출처가?", "편차가 큰 항목은?", "총 매칭 건수?"
→ [컨텍스트] 데이터만 인용. 그곳에 없으면 "데이터에 없습니다" 라고 분명히 답함.
→ 숫자·출처 URL·수집일·지역·신뢰도 등은 컨텍스트의 값을 그대로.

【조언·해석】 — "어떻게 / 왜 / 일반적으로" 류 질문
  예: "신뢰도를 높이려면?", "왜 비싸지?", "협상 포인트는?", "이 편차는 보통 어떤 의미야?"
→ 이 견적의 데이터를 출발점으로, 단가 검토 시스템 / 매칭 알고리즘 /
   건축 자재·노임 시장 관행의 일반 상식 범위에서 2~5문장으로 짧게 조언 OK.
→ 단, 구체적인 새 숫자·날짜·출처를 지어내지 마세요. 일반 원칙·체크리스트 위주.
→ 답변 안에서 "데이터 기준" 부분과 "일반적인 권고" 부분이 섞이면 톤으로 자연스럽게
   구분(예: "이 견적에서는 …이고, 일반적으로 …").

엄격 금지:
- 컨텍스트에 없는 가격·수치·날짜·출처 URL 을 사실인 양 답하기.
- 시계열 추이를 지어내기. 본 시스템은 사이클마다 DB swap 으로 단일 시점만 보존됩니다 —
  "현재 DB 는 단일 스냅샷이라 추이는 못 드린다" 는 안내는 OK.
- 견적/단가 검토와 무관한 잡담·다른 도메인 질문엔 정중히 거절하고 본 주제로 유도.

행 번호는 [라인 아이템] 블록의 앞 두 자리(01, 02...) 그대로 사용.
매칭 출처는 source(KPI/KPRC/CMPI/KPI-WAGE) + 카테고리/지역 + 수집일 + sourceUrl 기준으로 답변.`;

export interface BuildChatContextResult {
  systemPrompt: string;
  itemCount: number;
  found: boolean;
}

export async function buildChatContext(
  quotationId: number
): Promise<BuildChatContextResult> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      items: {
        orderBy: { rowIndex: "asc" },
        include: {
          matchedPrice: { include: { scrapeRun: true } },
          matchedWage: { include: { wageRun: true } },
        },
      },
      priceSummary: true,
    },
  });

  if (!quotation) {
    return { systemPrompt: "", itemCount: 0, found: false };
  }

  const meta =
    typeof quotation.rawResponse === "object" &&
    quotation.rawResponse !== null &&
    !Array.isArray(quotation.rawResponse)
      ? (quotation.rawResponse as Record<string, unknown>)
      : null;

  const headerLines: string[] = [
    `견적 #${quotation.id} — 총 ${quotation.items.length}개 라인 아이템`,
    `상태: ${quotation.status}`,
    `업로드 시각: ${quotation.uploadedAt.toISOString()}`,
  ];
  if (typeof meta?.projectName === "string" && meta.projectName)
    headerLines.push(`공사명: ${meta.projectName}`);
  if (typeof meta?.workType === "string" && meta.workType)
    headerLines.push(`공종: ${meta.workType}`);
  if (typeof meta?.spec === "string" && meta.spec)
    headerLines.push(`규격(공통): ${meta.spec}`);
  if (typeof meta?.reviewReason === "string" && meta.reviewReason)
    headerLines.push(`검토 사유: ${meta.reviewReason}`);
  if (typeof meta?.partnerName === "string" && meta.partnerName)
    headerLines.push(`협력사: ${meta.partnerName}`);
  if (typeof meta?.notes === "string" && meta.notes)
    headerLines.push(`특기사항: ${meta.notes}`);

  const itemLines = quotation.items.map((it, idx) => {
    const head: string[] = [
      `${String(idx + 1).padStart(2, "0")}. ${it.itemName}`,
    ];
    if (it.spec) head.push(`(${it.spec})`);
    if (it.unit) head.push(`/ ${it.unit}`);
    if (it.quantity != null) head.push(`/ 수량 ${it.quantity}`);
    if (it.unitPrice != null)
      head.push(`/ 협력사 ${it.unitPrice.toLocaleString()}원`);
    if (it.totalPrice != null)
      head.push(`(합계 ${it.totalPrice.toLocaleString()}원)`);

    const detail: string[] = [];
    if (it.matchedSource === "wage" && it.matchedWage) {
      const w = it.matchedWage;
      const cateLabel = WAGE_CATE_LABELS[w.cateCd] ?? w.cateCd;
      detail.push(
        `매칭=노임/${w.jobName} [${(w.source ?? "kpi-wage").toUpperCase()} · ${cateLabel}${w.basis ? ` · ${w.basis}` : ""}]`
      );
      if (w.wageRun?.sourceUrl)
        detail.push(`출처URL=${w.wageRun.sourceUrl}`);
      detail.push(`수집일=${ymd(w.fetchedAt)}`);
    } else if (it.matchedPrice) {
      const p = it.matchedPrice;
      detail.push(
        `매칭=자재/${p.itemName}${p.spec ? ` (${p.spec})` : ""} [${p.source.toUpperCase()}${p.region ? ` · ${p.region}` : ""}]`
      );
      if (p.scrapeRun?.sourceUrl)
        detail.push(`출처URL=${p.scrapeRun.sourceUrl}`);
      detail.push(`수집일=${ymd(p.fetchedAt)}`);
    } else {
      detail.push("매칭 실패");
    }

    if (it.marketPrice != null) {
      detail.push(
        `시장가=${it.marketPrice.toLocaleString()}원${it.marketRegion ? ` (${it.marketRegion})` : ""}`
      );
    }
    if (it.deviationPct != null) {
      detail.push(
        `편차=${it.deviationPct > 0 ? "+" : ""}${it.deviationPct.toFixed(1)}%`
      );
    }
    if (it.matchedConfidence != null) {
      detail.push(`신뢰도=${(it.matchedConfidence * 100).toFixed(0)}%`);
    }

    return [head.join(" "), `   → ${detail.join(" / ")}`].join("\n");
  });

  // 합계
  const partnerTotal =
    num(meta?.partnerPrice) ??
    (quotation.items.reduce((a, it) => a + (it.totalPrice ?? 0), 0) || null);
  const partnerMaterial = num(meta?.materialCost);
  const partnerLabor = num(meta?.laborCost);
  const partnerExpense = num(meta?.expenseCost);

  const matchedCount = quotation.items.filter(
    (it) => it.matchedPriceId != null || it.matchedWageId != null
  ).length;
  const overCount = quotation.items.filter(
    (it) => it.deviationPct != null && it.deviationPct > 10
  ).length;
  const underCount = quotation.items.filter(
    (it) => it.deviationPct != null && it.deviationPct < -10
  ).length;

  const matchedItems = quotation.items.filter((it) => it.marketPrice != null);
  const itemMarketTotal =
    matchedItems.length > 0
      ? matchedItems.reduce(
          (a, it) => a + (it.marketPrice ?? 0) * (it.quantity ?? 1),
          0
        )
      : null;
  // 세부 합계의 재료비/노무비 분해
  const itemMaterialTotal =
    matchedItems
      .filter((it) => it.matchedSource === "price")
      .reduce((a, it) => a + (it.marketPrice ?? 0) * (it.quantity ?? 1), 0) ||
    null;
  const itemLaborTotal =
    matchedItems
      .filter((it) => it.matchedSource === "wage")
      .reduce((a, it) => a + (it.marketPrice ?? 0) * (it.quantity ?? 1), 0) ||
    null;

  const totalsBlock: string[] = [
    "[항목 요약]",
    `- 매칭 ${matchedCount}/${quotation.items.length}건 (자재+노임 합산)`,
    `- 시장 대비 비쌈 ${overCount}건 / 저렴 ${underCount}건`,
  ];

  totalsBlock.push("", "[협력사 합계]");
  totalsBlock.push(
    `- 합계 ${partnerTotal != null ? partnerTotal.toLocaleString() + "원" : "N/A"}`
  );
  if (
    partnerMaterial != null ||
    partnerLabor != null ||
    partnerExpense != null
  ) {
    totalsBlock.push(
      `- 재료비 ${partnerMaterial != null ? partnerMaterial.toLocaleString() + "원" : "N/A"} / 노무비 ${partnerLabor != null ? partnerLabor.toLocaleString() + "원" : "N/A"} / 경비 ${partnerExpense != null ? partnerExpense.toLocaleString() + "원" : "N/A"}`
    );
  }

  const summary = quotation.priceSummary;
  if (summary) {
    totalsBlock.push("", "[일괄 단가 매칭 자료]");
    totalsBlock.push(
      `- 명칭: ${summary.name}${summary.spec ? ` / ${summary.spec}` : ""}${summary.unit ? ` / ${summary.unit}` : ""}`
    );
    totalsBlock.push(
      `- 합계 ${summary.totalCost != null ? summary.totalCost.toLocaleString() + "원" : "N/A"} / 재료비 ${summary.materialCost != null ? summary.materialCost.toLocaleString() + "원" : "N/A"} / 노무비 ${summary.laborCost != null ? summary.laborCost.toLocaleString() + "원" : "N/A"} / 경비 ${summary.expenseCost != null ? summary.expenseCost.toLocaleString() + "원" : "N/A"}`
    );
    if (summary.sourceFile)
      totalsBlock.push(
        `- 출처 파일: ${summary.sourceFile}${summary.sourceVia ? ` (${summary.sourceVia})` : ""}`
      );
    if (
      partnerTotal != null &&
      summary.totalCost != null &&
      summary.totalCost !== 0
    ) {
      const dev =
        ((partnerTotal - summary.totalCost) / summary.totalCost) * 100;
      totalsBlock.push(
        `- 협력사 vs 매칭자료 편차: ${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`
      );
    }
  } else {
    totalsBlock.push("", "[일괄 단가 매칭 자료] 선택되지 않음");
  }

  if (itemMarketTotal != null) {
    totalsBlock.push("", "[세부 항목별 시장단가 합계]");
    totalsBlock.push(
      `- 매칭된 ${matchedItems.length}/${quotation.items.length}건의 시장단가 × 수량 합산: ${itemMarketTotal.toLocaleString()}원`
    );
    totalsBlock.push(
      `- 재료비(자재 매칭) ${itemMaterialTotal != null ? itemMaterialTotal.toLocaleString() + "원" : "N/A"} / 노무비(노임 매칭) ${itemLaborTotal != null ? itemLaborTotal.toLocaleString() + "원" : "N/A"} / 경비 N/A (라인에서 도출 불가)`
    );
    if (partnerTotal != null && itemMarketTotal !== 0) {
      const dev = ((partnerTotal - itemMarketTotal) / itemMarketTotal) * 100;
      totalsBlock.push(
        `- 협력사 vs 세부합계 편차: ${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`
      );
    }
  } else {
    totalsBlock.push(
      "",
      "[세부 항목별 시장단가 합계] 매칭된 항목 없어 산출 불가"
    );
  }

  const userMsg = [
    "[견적 정보]",
    headerLines.join("\n"),
    "",
    "[라인 아이템]",
    itemLines.join("\n"),
    "",
    totalsBlock.join("\n"),
  ].join("\n");

  const systemPrompt = `${SYSTEM_INSTRUCTIONS}

[컨텍스트]
${userMsg}`;

  return {
    systemPrompt,
    itemCount: quotation.items.length,
    found: true,
  };
}
