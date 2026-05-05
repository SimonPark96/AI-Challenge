import * as XLSX from "xlsx";
import { getOpenAIClient } from "./client";
import type {
  ParsedQuote,
  ParsedQuoteItem,
  ParsedQuoteMeta,
  ParsedQuoteCostSummary,
} from "./types";

const MAX_CHARS = 80_000; // ~20K tokens — gpt-4o 컨텍스트 안에서 안전한 한도

const SYSTEM_PROMPT = `당신은 건축 자재 견적서 / 일위대가표 분석 전문가입니다.
입력으로 견적서 시트의 CSV 가 주어집니다. 다음 세 가지를 추출하세요.

1) meta — 견적서 상단의 헤더 영역에서:
   - projectName: 공사명/프로젝트명 (예: "○○ 신축공사")
   - requester:   요청자/담당자 이름
   - partnerName: 협력사명/업체명/거래처
   - workType:    공종 (예: "철근콘크리트공사", "강구조공사")
   - location:    시공위치/공사주소
   값이 명확히 안 보이면 null.

2) costSummary — 시트 하단의 비용 합계 영역(보통 "재료비 / 노무비 / 경비" + "합계" 행)
   에서 각 항목의 **마지막 최종 합계** 금액(원):
   - materialCost: 재료비 합계
   - laborCost:    노무비 합계
   - expenseCost:  경비 합계
   - totalCost:    재료비+노무비+경비의 총합 (있으면)
   부가세/공급가액 같은 별개 행은 무시하고 "합계 / 총계 / 총원가" 같은 라벨이 붙은
   마지막 행을 우선 채택. 콤마/원 단위 기호는 제거해 number 로.

3) items — 라인 아이템 배열:
   - itemName: 자재명 (필수, 비어있으면 행 제외)
   - spec: 규격/사양
   - unit: 단위 (EA / M / M2 / KG / TON 등)
   - quantity: 수량 (number)
   - unitPrice: 단가 (원, number)
   - totalPrice: 합계 (원, number)
   헤더 행, 빈 행, 소계/합계/부가세 행, 분류명("재료비 합계", "직접재료비 소계" 등)은 제외.
   숫자 셀의 콤마/단위는 제거하고 number 로 변환. 변환 불가능하면 null.`;

const QUOTE_SCHEMA = {
  type: "object",
  properties: {
    meta: {
      type: "object",
      properties: {
        projectName: { type: ["string", "null"] },
        requester: { type: ["string", "null"] },
        partnerName: { type: ["string", "null"] },
        workType: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
      },
      required: [
        "projectName",
        "requester",
        "partnerName",
        "workType",
        "location",
      ],
      additionalProperties: false,
    },
    costSummary: {
      type: "object",
      properties: {
        materialCost: { type: ["number", "null"] },
        laborCost: { type: ["number", "null"] },
        expenseCost: { type: ["number", "null"] },
        totalCost: { type: ["number", "null"] },
      },
      required: ["materialCost", "laborCost", "expenseCost", "totalCost"],
      additionalProperties: false,
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          itemName: { type: "string" },
          spec: { type: ["string", "null"] },
          unit: { type: ["string", "null"] },
          quantity: { type: ["number", "null"] },
          unitPrice: { type: ["number", "null"] },
          totalPrice: { type: ["number", "null"] },
        },
        required: [
          "itemName",
          "spec",
          "unit",
          "quantity",
          "unitPrice",
          "totalPrice",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["meta", "costSummary", "items"],
  additionalProperties: false,
} as const;

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function parseSpreadsheetWithChat(
  file: File
): Promise<ParsedQuote> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });

  if (workbook.SheetNames.length === 0) {
    throw new Error("스프레드시트에 시트가 없습니다.");
  }

  // 가장 큰(데이터가 많은) 시트 선택
  let bestName: string | null = null;
  let bestCsv = "";
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet || !sheet["!ref"]) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.length > bestCsv.length) {
      bestCsv = csv;
      bestName = name;
    }
  }

  if (!bestName) {
    throw new Error("스프레드시트에서 비어있지 않은 시트를 찾지 못했습니다.");
  }

  const truncated =
    bestCsv.length > MAX_CHARS
      ? bestCsv.slice(0, MAX_CHARS) + "\n...(truncated)"
      : bestCsv;
  const truncatedFlag = bestCsv.length > MAX_CHARS;

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `시트 "${bestName}" (총 ${workbook.SheetNames.length}개 시트 중 최대) 의 CSV:\n\n${truncated}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "QuoteExtraction",
        strict: true,
        schema: QUOTE_SCHEMA,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI: 응답이 비어있음");
  }

  const parsed = JSON.parse(content) as {
    meta: Partial<ParsedQuoteMeta>;
    costSummary: Partial<ParsedQuoteCostSummary>;
    items: ParsedQuoteItem[];
  };

  const meta: ParsedQuoteMeta = {
    projectName: strOrNull(parsed.meta?.projectName),
    requester: strOrNull(parsed.meta?.requester),
    partnerName: strOrNull(parsed.meta?.partnerName),
    workType: strOrNull(parsed.meta?.workType),
    location: strOrNull(parsed.meta?.location),
  };

  const costSummary: ParsedQuoteCostSummary = {
    materialCost: numOrNull(parsed.costSummary?.materialCost),
    laborCost: numOrNull(parsed.costSummary?.laborCost),
    expenseCost: numOrNull(parsed.costSummary?.expenseCost),
    totalCost: numOrNull(parsed.costSummary?.totalCost),
  };

  return {
    items: (parsed.items ?? []).map((it) => ({
      itemName: String(it.itemName ?? "").trim(),
      spec: it.spec != null ? String(it.spec).trim() : null,
      unit: it.unit != null ? String(it.unit).trim() : null,
      quantity: numOrNull(it.quantity),
      unitPrice: numOrNull(it.unitPrice),
      totalPrice: numOrNull(it.totalPrice),
    })),
    meta,
    costSummary,
    raw: parsed,
    via: "spreadsheet",
    debug: {
      sheetName: bestName,
      totalSheets: workbook.SheetNames.length,
      csvChars: bestCsv.length,
      truncated: truncatedFlag,
      tokensUsed: completion.usage,
    },
  };
}
