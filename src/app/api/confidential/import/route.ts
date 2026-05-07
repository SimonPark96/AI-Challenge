import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { embedTexts } from "@/lib/openai/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HEADER_KEYS = {
  name: ["명칭", "품명", "공종명", "name"],
  spec: ["규격", "사양", "spec"],
  unit: ["단위", "unit"],
  materialCost: ["재료비", "재료", "material"],
  laborCost: ["노무비", "노무", "labor"],
  expenseCost: ["경비", "expense"],
  totalCost: ["단가계", "합계", "총액", "total"],
};

const SHEET_EXT = new Set(["xlsx", "xls", "csv"]);

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
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  totalCost: number | null;
}

function parseExcel(buffer: Buffer, fileName: string): ParsedRow[] {
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
    const hasName = HEADER_KEYS.name.some((k) => row.some((c) => c.includes(k)));
    const hasCost =
      HEADER_KEYS.totalCost.some((k) => row.some((c) => c.includes(k))) ||
      HEADER_KEYS.materialCost.some((k) => row.some((c) => c.includes(k)));
    if (hasName && hasCost) {
      headerIdx = i;
      headers = row;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error(
      `헤더 행을 찾지 못했습니다 (${fileName}). 명칭 + 단가계/재료비 컬럼이 필요합니다.`
    );
  }

  const idx = {
    name: findColumnIndex(headers, HEADER_KEYS.name),
    spec: findColumnIndex(headers, HEADER_KEYS.spec),
    unit: findColumnIndex(headers, HEADER_KEYS.unit),
    materialCost: findColumnIndex(headers, HEADER_KEYS.materialCost),
    laborCost: findColumnIndex(headers, HEADER_KEYS.laborCost),
    expenseCost: findColumnIndex(headers, HEADER_KEYS.expenseCost),
    totalCost: findColumnIndex(headers, HEADER_KEYS.totalCost),
  };
  if (idx.name < 0) throw new Error("명칭 컬럼을 찾지 못했습니다.");

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = (aoa[i] ?? []).map((c) => String(c ?? "").trim());
    const name = idx.name >= 0 ? row[idx.name] : "";
    if (!name) continue;

    const mat = idx.materialCost >= 0 ? parseAmount(row[idx.materialCost]) : null;
    const lab = idx.laborCost >= 0 ? parseAmount(row[idx.laborCost]) : null;
    const exp = idx.expenseCost >= 0 ? parseAmount(row[idx.expenseCost]) : null;
    let total = idx.totalCost >= 0 ? parseAmount(row[idx.totalCost]) : null;
    // 단가계 컬럼 없으면 재료비+노무비+경비 합산
    if (total === null && (mat !== null || lab !== null || exp !== null)) {
      total = (mat ?? 0) + (lab ?? 0) + (exp ?? 0);
    }

    rows.push({
      name,
      spec: idx.spec >= 0 ? row[idx.spec] || null : null,
      unit: idx.unit >= 0 ? row[idx.unit] || null : null,
      materialCost: mat,
      laborCost: lab,
      expenseCost: exp,
      totalCost: total,
    });
  }
  return rows;
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data 가 필요합니다." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "'file' 필드에 파일이 필요합니다." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "빈 파일입니다." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!SHEET_EXT.has(ext)) {
    return NextResponse.json(
      { error: `지원하지 않는 형식 (.${ext}). XLSX / XLS / CSV 만 가능합니다.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows: ParsedRow[];
  try {
    rows = parseExcel(buffer, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "추출된 데이터 행이 없습니다." }, { status: 400 });
  }

  const fetchedAt = new Date();
  const sourceFile = file.name.slice(0, 200);

  const created = await prisma.$transaction(
    rows.map((r) =>
      prisma.confidentialPrice.create({
        data: {
          name: r.name,
          spec: r.spec,
          unit: r.unit,
          materialCost: r.materialCost,
          laborCost: r.laborCost,
          expenseCost: r.expenseCost,
          totalCost: r.totalCost,
          sourceFile,
          fetchedAt,
        },
        select: { id: true, name: true, spec: true },
      })
    )
  );

  let embeddedCount = 0;
  let embedError: string | null = null;
  try {
    const texts = created.map((p) =>
      p.spec ? `${p.name.trim()} ${p.spec.trim()}` : p.name.trim()
    );
    const vectors = await embedTexts(texts);
    await prisma.$transaction(
      created.map((p, i) =>
        prisma.confidentialPrice.update({
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
    rowCount: rows.length,
    insertedCount: created.length,
    embeddedCount,
    embedError,
    sample: rows.slice(0, 3),
  });
}
