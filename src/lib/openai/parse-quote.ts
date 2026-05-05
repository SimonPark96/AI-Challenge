import { getOpenAIClient } from "./client";
import { parseSpreadsheetWithChat } from "./parse-spreadsheet";
import type {
  ParsedQuote,
  ParsedQuoteItem,
  ParsedQuoteMeta,
  ParsedQuoteCostSummary,
} from "./types";

export type { ParsedQuote, ParsedQuoteItem };

/**
 * 견적서 파일 → 라인 아이템 + 헤더 메타 + 비용 합계.
 *
 * 분기:
 *   - .xlsx / .xls / .csv  → 서버에서 xlsx 패키지로 파싱 후 Chat Completions (json_schema strict)
 *   - .pdf / .docx / 기타  → Assistants API + code_interpreter
 */
export async function parseQuoteWithOpenAI(file: File): Promise<ParsedQuote> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "xlsx" || ext === "xls" || ext === "csv") {
    return parseSpreadsheetWithChat(file);
  }
  return parseViaAssistants(file);
}

const ASSISTANT_INSTRUCTIONS = `당신은 건축 자재 견적서 / 일위대가표 분석 전문가입니다.
업로드된 파일에서 헤더 메타, 비용 합계, 라인 아이템 3가지를 추출해 JSON 으로 반환하세요.
THK 라는 단어는 두께를 의미하며 예: THK10 = 10T = 두께 10.
첨부 파일은 code_interpreter 로 직접 읽어(PDF는 pypdf, DOCX는 python-docx 등) 정확하게 추출.

반드시 다음 JSON 형식으로만 응답:
{
  "meta": {
    "projectName": "공사명 or null",
    "requester":   "요청자 or null",
    "partnerName": "협력사명 or null",
    "workType":    "공종 or null",
    "location":    "시공위치 or null"
  },
  "costSummary": {
    "materialCost": <number or null>,   // 재료비 합계 (마지막 최종 합계)
    "laborCost":    <number or null>,   // 노무비 합계
    "expenseCost":  <number or null>,   // 경비 합계
    "totalCost":    <number or null>    // 재료+노무+경비 총합
  },
  "items": [
    { "itemName": "...", "spec": null, "unit": null, "quantity": null, "unitPrice": null, "totalPrice": null }
  ]
}

규칙:
- meta 의 각 필드는 헤더/표지/제목 영역에서 찾아라. 명확하지 않으면 null.
- costSummary 의 각 필드는 시트 하단 비용 합계 영역의 마지막 행을 사용. 부가세/공급가액 등은 무시.
- items 배열은 라인 아이템만. 헤더/소계/합계/부가세/분류명 행은 제외.
- 숫자는 콤마/단위 제거 후 number, 변환 불가능하면 null.`;

let cachedAssistantId: string | null = null;

async function getAssistantId(): Promise<string> {
  if (cachedAssistantId) return cachedAssistantId;
  const client = getOpenAIClient();
  const a = await client.beta.assistants.create({
    name: "Construction Quote Parser",
    model: "gpt-4o",
    instructions: ASSISTANT_INSTRUCTIONS,
    tools: [{ type: "code_interpreter" }],
    response_format: { type: "json_object" },
  });
  cachedAssistantId = a.id;
  return a.id;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function parseViaAssistants(file: File): Promise<ParsedQuote> {
  const client = getOpenAIClient();
  const assistantId = await getAssistantId();

  const uploaded = await client.files.create({
    file,
    purpose: "assistants",
  });

  const thread = await client.beta.threads.create({
    messages: [
      {
        role: "user",
        content: `첨부된 파일 "${file.name}" 에서 위 지시에 따라 meta / costSummary / items 를 JSON 으로 추출하세요.`,
        attachments: [
          {
            file_id: uploaded.id,
            tools: [{ type: "code_interpreter" }],
          },
        ],
      },
    ],
  });

  const run = await client.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: assistantId,
  });

  if (run.status !== "completed") {
    throw new Error(
      `OpenAI run failed: ${run.status} — ${
        run.last_error?.message ?? "(no detail)"
      }`
    );
  }

  const messages = await client.beta.threads.messages.list(thread.id, {
    order: "desc",
    limit: 5,
  });
  const assistantMsg = messages.data.find((m) => m.role === "assistant");
  if (!assistantMsg) throw new Error("OpenAI: 어시스턴트 응답을 찾지 못함");

  const textBlock = assistantMsg.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("OpenAI: 텍스트 응답을 찾지 못함");
  }

  const rawText = textBlock.text.value.replace(/【[^】]*】/g, "").trim();

  let parsed: {
    meta?: Partial<ParsedQuoteMeta>;
    costSummary?: Partial<ParsedQuoteCostSummary>;
    items?: ParsedQuoteItem[];
  };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      `OpenAI 응답을 JSON 으로 파싱 실패. 자연어 응답: ${rawText.slice(0, 500)}`
    );
  }

  await Promise.allSettled([
    client.files.delete(uploaded.id),
    client.beta.threads.delete(thread.id),
  ]);

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
    via: "assistants",
    debug: {
      assistantId,
      threadId: thread.id,
      fileId: uploaded.id,
    },
  };
}
