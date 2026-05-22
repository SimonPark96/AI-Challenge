import * as XLSX from "xlsx";
import { getOpenAIClient } from "./client";
import type {
  ParsedQuote,
  ParsedQuoteItem,
  ParsedQuoteMeta,
  ParsedQuoteCostSummary,
} from "./types";

const MAX_CHARS_SINGLE = 80_000; // ~20K tokens — 단일 시트 모드용
const MAX_CHARS_PER_SHEET = 40_000; // 2시트 모드: 시트당 한도

const SYSTEM_PROMPT_SINGLE = `당신은 건축 자재 견적서 / 일위대가표 분석 전문가입니다.
입력으로 견적서 시트의 CSV 가 주어집니다. 다음 세 가지를 추출하세요.

1) meta — 견적서 상단의 헤더 영역에서:
   - projectName: 공사명/프로젝트명 (예: "○○ 신축공사")
   - requester:   요청자/담당자 이름
   - partnerName: 협력사명/업체명/거래처
   - workType:    공종 (예: "철근콘크리트공사", "강구조공사")
   - spec:        공사 규격/사양 (예: "SD400 D16", "THK10", "B1F~5F" 등 헤더에 명시된 규격 정보)
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

const SYSTEM_PROMPT_TWO_SHEETS = `당신은 건축 자재 견적서 / 일위대가표 분석 전문가입니다.
입력으로 두 개의 시트가 주어집니다.
- 첫 번째 시트는 "견적서": 헤더(공사명·요청자·협력사·공종·시공위치)와 하단 비용 합계 영역을 포함합니다.
- 두 번째 시트는 "일위대가": 라인 아이템 상세(자재명·규격·단위·수량·단가·금액)를 포함합니다.

다음 세 가지를 추출하세요. **각 필드의 출처 시트를 엄격히 지키세요.**

1) meta — **반드시 첫 번째 시트(견적서)의 헤더 영역에서만** 추출:
   - projectName: 공사명/프로젝트명 (예: "○○ 신축공사")
   - requester:   요청자/담당자 이름
   - partnerName: 협력사명/업체명/거래처
   - workType:    공종 (예: "철근콘크리트공사", "강구조공사")
   - spec:        공사 규격/사양 (예: "SD400 D16", "THK10", "B1F~5F" 등 헤더에 명시된 규격 정보)
   - location:    시공위치/공사주소
   값이 명확히 안 보이면 null.

2) costSummary — **반드시 첫 번째 시트(견적서) 하단 비용 합계 영역에서만** 추출:
   - materialCost: 재료비 합계
   - laborCost:    노무비 합계
   - expenseCost:  경비 합계
   - totalCost:    재료비+노무비+경비의 총합 (있으면)
   부가세/공급가액 같은 별개 행은 무시하고 "합계 / 총계 / 총원가" 같은 라벨이 붙은
   마지막 행을 우선 채택. 콤마/원 단위 기호는 제거해 number 로.

3) items — **반드시 두 번째 시트(일위대가)의 라인 아이템에서만** 추출:
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
        spec: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
      },
      required: [
        "projectName",
        "requester",
        "partnerName",
        "workType",
        "spec",
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

interface ParsedRaw {
  meta: Partial<ParsedQuoteMeta>;
  costSummary: Partial<ParsedQuoteCostSummary>;
  items: ParsedQuoteItem[];
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function csvOfSheet(workbook: XLSX.WorkBook, name: string): string {
  const sheet = workbook.Sheets[name];
  if (!sheet || !sheet["!ref"]) return "";
  return XLSX.utils.sheet_to_csv(sheet);
}

function truncate(
  s: string,
  max: number
): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max) + "\n...(truncated)", truncated: true };
}

function normalizeParsed(parsed: ParsedRaw): {
  items: ParsedQuoteItem[];
  meta: ParsedQuoteMeta;
  costSummary: ParsedQuoteCostSummary;
} {
  const meta: ParsedQuoteMeta = {
    projectName: strOrNull(parsed.meta?.projectName),
    requester: strOrNull(parsed.meta?.requester),
    partnerName: strOrNull(parsed.meta?.partnerName),
    workType: strOrNull(parsed.meta?.workType),
    spec: strOrNull(parsed.meta?.spec),
    location: strOrNull(parsed.meta?.location),
  };
  const costSummary: ParsedQuoteCostSummary = {
    materialCost: numOrNull(parsed.costSummary?.materialCost),
    laborCost: numOrNull(parsed.costSummary?.laborCost),
    expenseCost: numOrNull(parsed.costSummary?.expenseCost),
    totalCost: numOrNull(parsed.costSummary?.totalCost),
  };
  const items = (parsed.items ?? []).map((it) => ({
    itemName: String(it.itemName ?? "").trim(),
    spec: it.spec != null ? String(it.spec).trim() : null,
    unit: it.unit != null ? String(it.unit).trim() : null,
    quantity: numOrNull(it.quantity),
    unitPrice: numOrNull(it.unitPrice),
    totalPrice: numOrNull(it.totalPrice),
  }));
  return { items, meta, costSummary };
}

export async function parseSpreadsheetWithChat(
  file: File
): Promise<ParsedQuote> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });

  if (workbook.SheetNames.length === 0) {
    throw new Error("스프레드시트에 시트가 없습니다.");
  }

  // 비어있지 않은 시트 추리기
  const nonEmpty = workbook.SheetNames.map((name) => ({
    name,
    csv: csvOfSheet(workbook, name),
  })).filter((s) => s.csv.length > 0);

  if (nonEmpty.length === 0) {
    throw new Error("스프레드시트에서 비어있지 않은 시트를 찾지 못했습니다.");
  }

  // 시트 2개 이상: 시트1=견적서(meta+costSummary), 시트2=일위대가(items) 분리 추출
  // 시트 1개: 단일 시트에서 모두 추출 (폴백)
  if (nonEmpty.length >= 2) {
    return parseTwoSheetWorkbook(
      nonEmpty[0],
      nonEmpty[1],
      workbook.SheetNames.length
    );
  }
  return parseSingleSheetWorkbook(nonEmpty[0], workbook.SheetNames.length);
}

async function parseSingleSheetWorkbook(
  sheet: { name: string; csv: string },
  totalSheets: number
): Promise<ParsedQuote> {
  const t = truncate(sheet.csv, MAX_CHARS_SINGLE);

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT_SINGLE },
      {
        role: "user",
        content: `시트 "${sheet.name}" (총 ${totalSheets}개 시트 중 1개) 의 CSV:\n\n${t.text}`,
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
  if (!content) throw new Error("OpenAI: 응답이 비어있음");

  const parsed = JSON.parse(content) as ParsedRaw;
  const { items, meta, costSummary } = normalizeParsed(parsed);

  return {
    items,
    meta,
    costSummary,
    raw: parsed,
    via: "spreadsheet",
    debug: {
      mode: "single",
      sheetName: sheet.name,
      totalSheets,
      csvChars: sheet.csv.length,
      truncated: t.truncated,
      tokensUsed: completion.usage,
    },
  };
}

async function parseTwoSheetWorkbook(
  quoteSheet: { name: string; csv: string },
  unitPriceSheet: { name: string; csv: string },
  totalSheets: number
): Promise<ParsedQuote> {
  const t1 = truncate(quoteSheet.csv, MAX_CHARS_PER_SHEET);
  const t2 = truncate(unitPriceSheet.csv, MAX_CHARS_PER_SHEET);

  const userContent =
    `==== 첫 번째 시트 (견적서): "${quoteSheet.name}" ====\n` +
    `${t1.text}\n\n` +
    `==== 두 번째 시트 (일위대가): "${unitPriceSheet.name}" ====\n` +
    `${t2.text}`;

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT_TWO_SHEETS },
      { role: "user", content: userContent },
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
  if (!content) throw new Error("OpenAI: 응답이 비어있음");

  const parsed = JSON.parse(content) as ParsedRaw;
  const { items, meta, costSummary } = normalizeParsed(parsed);

  return {
    items,
    meta,
    costSummary,
    raw: parsed,
    via: "spreadsheet",
    debug: {
      mode: "two-sheet",
      quoteSheet: quoteSheet.name,
      unitPriceSheet: unitPriceSheet.name,
      totalSheets,
      csvChars: { quote: quoteSheet.csv.length, unitPrice: unitPriceSheet.csv.length },
      truncated: { quote: t1.truncated, unitPrice: t2.truncated },
      tokensUsed: completion.usage,
    },
  };
}
