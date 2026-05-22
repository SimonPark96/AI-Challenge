import * as XLSX from "xlsx";

const HEADER_KEYS = {
  name: ["명칭", "품명", "공종명", "name"],
  spec: ["규격", "사양", "spec"],
  unit: ["단위", "unit"],
  materialCost: ["재료비", "재료", "material"],
  laborCost: ["노무비", "노무", "labor"],
  expenseCost: ["경비", "expense"],
  totalCost: ["단가계", "합계", "총액", "total"],
};

export interface ParsedBidRow {
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  totalCost: number | null;
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

function findCol(headers: string[], candidates: string[]): number {
  const normed = headers.map(norm);
  for (const c of candidates) {
    const i = normed.findIndex((h) => h.includes(norm(c)));
    if (i >= 0) return i;
  }
  return -1;
}

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[,\s원₩￦]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseReceivedBidExcel(buffer: Buffer, fileName: string): ParsedBidRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("시트가 없습니다.");
  const aoa: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1, raw: false, defval: "",
  });

  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const row = (aoa[i] ?? []).map((c) => String(c).trim());
    const hasName = HEADER_KEYS.name.some((k) => row.some((c) => c.includes(k)));
    const hasCost =
      HEADER_KEYS.totalCost.some((k) => row.some((c) => c.includes(k))) ||
      HEADER_KEYS.materialCost.some((k) => row.some((c) => c.includes(k)));
    if (hasName && hasCost) { headerIdx = i; headers = row; break; }
  }
  if (headerIdx < 0) {
    throw new Error(`헤더를 찾지 못했습니다 (${fileName}). 명칭 + 단가계/재료비 컬럼 필요.`);
  }

  const idx = {
    name: findCol(headers, HEADER_KEYS.name),
    spec: findCol(headers, HEADER_KEYS.spec),
    unit: findCol(headers, HEADER_KEYS.unit),
    materialCost: findCol(headers, HEADER_KEYS.materialCost),
    laborCost: findCol(headers, HEADER_KEYS.laborCost),
    expenseCost: findCol(headers, HEADER_KEYS.expenseCost),
    totalCost: findCol(headers, HEADER_KEYS.totalCost),
  };
  if (idx.name < 0) throw new Error("명칭 컬럼을 찾지 못했습니다.");

  const rows: ParsedBidRow[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = (aoa[i] ?? []).map((c) => String(c).trim());
    const itemName = row[idx.name] ?? "";
    if (!itemName) continue;

    const mat = idx.materialCost >= 0 ? parseAmount(row[idx.materialCost]) : null;
    const lab = idx.laborCost >= 0 ? parseAmount(row[idx.laborCost]) : null;
    const exp = idx.expenseCost >= 0 ? parseAmount(row[idx.expenseCost]) : null;
    let total = idx.totalCost >= 0 ? parseAmount(row[idx.totalCost]) : null;
    if (total === null && (mat !== null || lab !== null || exp !== null)) {
      total = (mat ?? 0) + (lab ?? 0) + (exp ?? 0);
    }

    rows.push({
      rowIndex: rows.length,
      itemName,
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
