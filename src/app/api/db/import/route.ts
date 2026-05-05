import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { embedTexts } from "@/lib/openai/embed";
import { getOpenAIClient } from "@/lib/openai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 외부 단가 자료 일괄 등록.
 *
 * 결과는 PriceSummary 에 저장됨 (PriceHistory 와 별개).
 * 협력사 일위대가의 "합계" 와 비교하기 위한, 명칭/규격 단위의 단가합계 데이터.
 */

const HEADER_KEYS = {
  name: ["명칭", "공종명", "품명", "공사명", "name"],
  spec: ["규격", "사양", "spec"],
  unit: ["단위", "unit"],
  totalCost: ["합계", "총합", "총액", "총원가", "total"],
  materialCost: ["재료비", "재료", "material"],
  laborCost: ["노무비", "노무", "labor"],
  expenseCost: ["경비", "expense"],
};

const SHEET_EXT = new Set(["xlsx", "xls", "csv"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalize);
  for (const c of candidates) {
    const cn = normalize(c);
    const i = norm.findIndex((h) => h.includes(cn));
    if (i >= 0) return i;
  }
  return -1;
}

function parseAmount(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[,\s원₩￦]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

interface ParsedRow {
  name: string;
  spec: string | null;
  unit: string | null;
  totalCost: number | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
}

interface ParseResult {
  via: "spreadsheet" | "image";
  sheetName: string;
  headerRow: number;
  headers: string[];
  rows: ParsedRow[];
}

async function parseExcel(file: File): Promise<ParseResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("시트가 없습니다.");
  const sheet = workbook.Sheets[sheetName];
  const aoa: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  let headerIdx = -1;
  let headers: string[] = [];
  const SCAN = Math.min(15, aoa.length);
  for (let i = 0; i < SCAN; i++) {
    const row = (aoa[i] ?? []).map((c) => String(c ?? "").trim());
    const hasName = HEADER_KEYS.name.some((k) =>
      row.some((c) => c.includes(k))
    );
    const hasTotal =
      HEADER_KEYS.totalCost.some((k) => row.some((c) => c.includes(k))) ||
      HEADER_KEYS.materialCost.some((k) => row.some((c) => c.includes(k))) ||
      HEADER_KEYS.spec.some((k) => row.some((c) => c.includes(k)));
    if (hasName && hasTotal) {
      headerIdx = i;
      headers = row;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error(
      "헤더 행을 찾지 못했습니다 (명칭 + 합계/재료비/규격 컬럼 필요)."
    );
  }

  const idx = {
    name: findColumnIndex(headers, HEADER_KEYS.name),
    spec: findColumnIndex(headers, HEADER_KEYS.spec),
    unit: findColumnIndex(headers, HEADER_KEYS.unit),
    totalCost: findColumnIndex(headers, HEADER_KEYS.totalCost),
    materialCost: findColumnIndex(headers, HEADER_KEYS.materialCost),
    laborCost: findColumnIndex(headers, HEADER_KEYS.laborCost),
    expenseCost: findColumnIndex(headers, HEADER_KEYS.expenseCost),
  };
  if (idx.name < 0) throw new Error("명칭 컬럼을 찾지 못했습니다.");

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = (aoa[i] ?? []).map((c) => String(c ?? "").trim());
    const name = row[idx.name];
    if (!name) continue;
    rows.push({
      name,
      spec: idx.spec >= 0 ? row[idx.spec] || null : null,
      unit: idx.unit >= 0 ? row[idx.unit] || null : null,
      totalCost:
        idx.totalCost >= 0 ? parseAmount(row[idx.totalCost]) : null,
      materialCost:
        idx.materialCost >= 0 ? parseAmount(row[idx.materialCost]) : null,
      laborCost:
        idx.laborCost >= 0 ? parseAmount(row[idx.laborCost]) : null,
      expenseCost:
        idx.expenseCost >= 0 ? parseAmount(row[idx.expenseCost]) : null,
    });
  }
  return { via: "spreadsheet", sheetName, headerRow: headerIdx, headers, rows };
}

const IMAGE_SYSTEM_PROMPT = `당신은 건축 자재 단가표 / 일위대가 분석 전문가입니다.
업로드된 단가 자료 이미지에서 "명칭 단위" 의 합계 행을 추출해 JSON 으로 반환하세요.
(개별 자재 단가가 아니라, 일위대가나 공종 단위의 합계 데이터)

각 행 필드:
- name: 명칭 / 공종명 / 공사명 (필수, 비어있으면 행 제외)
- spec: 규격 / 사양 (없으면 null)
- unit: 단위 (예: "EA", "M", "M2", "식"; 없으면 null)
- totalCost: 합계 단가 (원, number; 콤마/원/₩ 같은 기호 제거)
- materialCost: 재료비 (원, number; 없으면 null)
- laborCost: 노무비 (원, number; 없으면 null)
- expenseCost: 경비 (원, number; 없으면 null)

규칙:
- 헤더 행, 빈 행, 부가세/총계 행은 제외
- 분류명 / 카테고리(예: "1군 - 강관") 행은 제외
- 같은 명칭의 소계와 합계가 둘 다 보이면 "합계" 우선
- 숫자가 흐릿하면 해당 필드만 null 로 두고 name 은 살림
- THK 표기는 두께 (예: THK10 = 두께 10mm)`;

const IMAGE_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          spec: { type: ["string", "null"] },
          unit: { type: ["string", "null"] },
          totalCost: { type: ["number", "null"] },
          materialCost: { type: ["number", "null"] },
          laborCost: { type: ["number", "null"] },
          expenseCost: { type: ["number", "null"] },
        },
        required: [
          "name",
          "spec",
          "unit",
          "totalCost",
          "materialCost",
          "laborCost",
          "expenseCost",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["rows"],
  additionalProperties: false,
} as const;

function mimeFromExt(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function parseImage(file: File): Promise<ParseResult> {
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(
      `이미지가 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB). 최대 ${IMAGE_MAX_BYTES / 1024 / 1024}MB.`
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type && file.type.startsWith("image/")
    ? file.type
    : mimeFromExt(file.name);
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: IMAGE_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `이 단가 자료 이미지(${file.name}) 에서 명칭 단위의 합계 행을 모두 추출하세요.`,
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "PriceSummaryImage",
        strict: true,
        schema: IMAGE_SCHEMA,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI 응답이 비어있음");
  const parsed = JSON.parse(content) as { rows: ParsedRow[] };

  const rows: ParsedRow[] = (parsed.rows ?? [])
    .map((r) => ({
      name: String(r.name ?? "").trim(),
      spec: strOrNull(r.spec),
      unit: strOrNull(r.unit),
      totalCost: numOrNull(r.totalCost),
      materialCost: numOrNull(r.materialCost),
      laborCost: numOrNull(r.laborCost),
      expenseCost: numOrNull(r.expenseCost),
    }))
    .filter((r) => r.name !== "");

  return {
    via: "image",
    sheetName: `image:${file.name}`,
    headerRow: 0,
    headers: [
      "name",
      "spec",
      "unit",
      "totalCost",
      "materialCost",
      "laborCost",
      "expenseCost",
    ],
    rows,
  };
}

function buildSummaryEmbeddingText(
  name: string,
  spec: string | null
): string {
  const n = name.trim();
  const s = spec?.trim() ?? "";
  return s ? `${n} ${s}` : n;
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "multipart/form-data 가 필요합니다." },
      { status: 400 }
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "'file' 필드에 파일이 필요합니다." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "빈 파일입니다." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const isImage =
    IMAGE_EXT.has(ext) ||
    (file.type ? file.type.startsWith("image/") : false);
  const isSheet = SHEET_EXT.has(ext);

  if (!isImage && !isSheet) {
    return NextResponse.json(
      {
        error: `지원하지 않는 파일 형식입니다 (.${ext}). XLSX/XLS/CSV 또는 PNG/JPG/WEBP 만 가능합니다.`,
      },
      { status: 400 }
    );
  }

  let parsed: ParseResult;
  try {
    parsed = isImage ? await parseImage(file) : await parseExcel(file);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          parsed.via === "image"
            ? "이미지에서 행을 인식하지 못했습니다. 화질/구도 확인 후 재시도하세요."
            : "추출된 데이터 행이 없습니다.",
      },
      { status: 400 }
    );
  }

  const fetchedAt = new Date();
  const sourceFile = file.name.slice(0, 200);

  // 1) PriceSummary insert (createMany 는 SQLite + Json 미지원이라 트랜잭션으로 개별 create)
  const created = await prisma.$transaction(
    parsed.rows.map((r) =>
      prisma.priceSummary.create({
        data: {
          name: r.name,
          spec: r.spec,
          unit: r.unit,
          totalCost: r.totalCost,
          materialCost: r.materialCost,
          laborCost: r.laborCost,
          expenseCost: r.expenseCost,
          sourceFile,
          sourceVia: parsed.via,
          rawRow: r as unknown as Prisma.InputJsonValue,
          fetchedAt,
        },
        select: { id: true, name: true, spec: true },
      })
    )
  );

  // 2) 임베딩 백필
  let embeddedCount = 0;
  let embedError: string | null = null;
  try {
    const texts = created.map((p) => buildSummaryEmbeddingText(p.name, p.spec));
    const vectors = await embedTexts(texts);
    await prisma.$transaction(
      created.map((p, i) =>
        prisma.priceSummary.update({
          where: { id: p.id },
          data: { embedding: vectors[i] as Prisma.InputJsonValue },
        })
      )
    );
    embeddedCount = vectors.length;
  } catch (err) {
    embedError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    via: parsed.via,
    sheetName: parsed.sheetName,
    headerRow: parsed.headerRow,
    headers: parsed.headers,
    rowCount: parsed.rows.length,
    insertedCount: created.length,
    embeddedCount,
    embedError,
    sample: parsed.rows.slice(0, 3),
  });
}
