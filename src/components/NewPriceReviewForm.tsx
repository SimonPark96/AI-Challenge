"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, ClipboardList, Paperclip, X, FileText, FileImage, File } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type PriceMark = "O" | "△" | "X" | "";
/** 적용안 행의 출처 — 단가검토 섹션의 어느 테이블에서 왔는지를 그대로 표시. */
type SourceCategory =
  | "기계약단가"
  | "DB단가"
  | "실적단가"
  | "견적가"
  | "일위대가";

interface PriceRow {
  id: string;
  name: string;
  spec: string;
  quantity: string;
  materialCost: string;
  laborCost: string;
  expenseCost: string;
  unitTotal: string;
  totalAmount: string;
}

interface ReviewRow extends PriceRow {
  category: SourceCategory;
}

export interface QuotationItemData {
  itemName: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  marketPrice: number | null;
}

interface Props {
  quotationItems?: QuotationItemData[];
  quotationFileName?: string;
  /** DB단가 탭 최종 합계 */
  dbTotal?: number | null;
  /** 실적단가 탭 최종 선택 항목 */
  actualSummary?: {
    name?: string | null;
    totalCost?: number | null;
    materialCost?: number | null;
    laborCost?: number | null;
    expenseCost?: number | null;
  } | null;
  /** 비교견적 탭 선택 카드 목록 */
  competitorBids?: Array<{
    companyName?: string | null;
    totalCost?: number | null;
    materialCost?: number | null;
    laborCost?: number | null;
    expenseCost?: number | null;
  }>;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const MARK_CYCLE: PriceMark[] = ["O", "△", "X", ""];

let _id = 0;
function uid() { return String(++_id); }

function numVal(s: string): number {
  return parseFloat(s.replace(/,/g, "")) || 0;
}

function fmtStr(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "";
  return Math.round(n).toLocaleString();
}

function fmtInput(s: string): string {
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? "" : Math.round(n).toLocaleString();
}

function rowUnitTotal(r: PriceRow): number {
  if (numVal(r.unitTotal) > 0) return numVal(r.unitTotal);
  return numVal(r.materialCost) + numVal(r.laborCost) + numVal(r.expenseCost);
}

function rowTotal(r: PriceRow): number {
  if (numVal(r.totalAmount) > 0) return numVal(r.totalAmount);
  const unit = rowUnitTotal(r);
  return unit * numVal(r.quantity);
}

function sumRows(rows: PriceRow[]): number {
  return rows.reduce((a, r) => a + rowTotal(r), 0);
}

function makeRow(o: Partial<PriceRow> = {}): PriceRow {
  return { id: uid(), name: "", spec: "", quantity: "", materialCost: "", laborCost: "", expenseCost: "", unitTotal: "", totalAmount: "", ...o };
}

function fromItem(item: QuotationItemData): PriceRow {
  return makeRow({
    name: item.itemName,
    spec: item.spec ?? "",
    quantity: fmtStr(item.quantity),
    unitTotal: fmtStr(item.unitPrice),
    totalAmount: fmtStr(item.totalPrice),
  });
}

function fromItemMarketPrice(item: QuotationItemData): PriceRow {
  const amt = item.marketPrice != null && item.quantity != null
    ? Math.round(item.marketPrice * item.quantity) : null;
  return makeRow({
    name: item.itemName,
    spec: item.spec ?? "",
    quantity: fmtStr(item.quantity),
    unitTotal: fmtStr(item.marketPrice),
    totalAmount: fmtStr(amt),
  });
}

// ─────────────────────────────────────────────
// Table cell primitives
// ─────────────────────────────────────────────

function TCell({ value, onChange, placeholder = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <td className="border border-slate-200 p-0">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-[5px] text-xs focus:outline-none focus:bg-blue-50 bg-transparent"
      />
    </td>
  );
}

function NCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <td className="border border-slate-200 p-0">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        onBlur={(e) => onChange(fmtInput(e.target.value))}
        placeholder="-"
        className="w-full px-2 py-[5px] text-xs text-right font-mono focus:outline-none focus:bg-blue-50 bg-transparent"
      />
    </td>
  );
}

function ReadCell({ value }: { value: string }) {
  return (
    <td className="border border-slate-200 px-2 py-[5px] text-xs text-right font-mono text-slate-600 bg-slate-50/50">
      {value || "-"}
    </td>
  );
}

function TH({ children, cls = "" }: { children: React.ReactNode; cls?: string }) {
  return (
    <th className={`border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-500 text-center bg-slate-50 whitespace-nowrap ${cls}`}>
      {children}
    </th>
  );
}

// ─────────────────────────────────────────────
// Sub-tables
// ─────────────────────────────────────────────

function EstimateTable({
  rows,
  setRows,
  tableKey,
  selectedKeys,
  onToggleSelect,
}: {
  rows: PriceRow[];
  setRows: (r: PriceRow[]) => void;
  /** "contract" | "db" | "actual" | "estimate" | "unit" — 선택 키 prefix */
  tableKey?: string;
  selectedKeys?: Set<string>;
  onToggleSelect?: (rowId: string) => void;
}) {
  function update(id: string, field: keyof PriceRow, val: string) {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  }
  function remove(id: string) { setRows(rows.filter(r => r.id !== id)); }
  const total = sumRows(rows);
  const selectable = !!(tableKey && selectedKeys && onToggleSelect);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: selectable ? 720 : 680 }}>
        <thead>
          <tr>
            {selectable && <TH cls="w-8">선택</TH>}
            <TH cls="w-36">명칭</TH>
            <TH cls="w-24">규격</TH>
            <TH cls="w-16">수량</TH>
            <TH cls="w-20">재료비</TH>
            <TH cls="w-20">노무비</TH>
            <TH cls="w-16">경비</TH>
            <TH cls="w-20">단가계</TH>
            <TH cls="w-24">금액</TH>
            <th className="border border-slate-200 bg-slate-50 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const computed = rowUnitTotal(r);
            const computedAmt = computed * numVal(r.quantity);
            const selKey = selectable ? `${tableKey}:${r.id}` : null;
            const isSelected = selKey ? selectedKeys!.has(selKey) : false;
            return (
              <tr
                key={r.id}
                className={`transition-colors ${
                  isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/60"
                }`}
              >
                {selectable && (
                  <td className="border border-slate-200 text-center bg-slate-50/40">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect!(r.id)}
                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                      aria-label="적용안에 포함"
                    />
                  </td>
                )}
                <TCell value={r.name} onChange={v => update(r.id, "name", v)} placeholder="명칭" />
                <TCell value={r.spec} onChange={v => update(r.id, "spec", v)} placeholder="규격" />
                <NCell value={r.quantity} onChange={v => update(r.id, "quantity", v)} />
                <NCell value={r.materialCost} onChange={v => update(r.id, "materialCost", v)} />
                <NCell value={r.laborCost} onChange={v => update(r.id, "laborCost", v)} />
                <NCell value={r.expenseCost} onChange={v => update(r.id, "expenseCost", v)} />
                <NCell value={r.unitTotal || (computed ? fmtStr(computed) : "")} onChange={v => update(r.id, "unitTotal", v)} />
                <NCell value={r.totalAmount || (computedAmt ? fmtStr(computedAmt) : "")} onChange={v => update(r.id, "totalAmount", v)} />
                <td className="border border-slate-200 text-center bg-slate-50/50">
                  <button onClick={() => remove(r.id)} className="text-slate-300 hover:text-rose-400 px-1 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={selectable ? 8 : 7} className="border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-slate-600 bg-slate-50">
              합 계
            </td>
            <td className="border border-slate-200 px-2 py-1.5 text-right text-xs font-mono font-bold text-slate-800 bg-slate-50">
              {total ? total.toLocaleString() : "-"}
            </td>
            <td className="border border-slate-200 bg-slate-50" />
          </tr>
        </tfoot>
      </table>
      <button
        onClick={() => setRows([...rows, makeRow()])}
        className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
      >
        <Plus size={12} /> 행 추가
      </button>
    </div>
  );
}

function AppliedTable({ rows }: { rows: ReviewRow[] }) {
  const typeStyle: Record<SourceCategory, string> = {
    "기계약단가": "bg-slate-100/60 text-slate-600",
    "DB단가":     "bg-rose-50/60 text-rose-700",
    "실적단가":   "bg-sky-50/60 text-sky-700",
    "견적가":     "bg-amber-50/60 text-amber-700",
    "일위대가":   "bg-emerald-50/60 text-emerald-700",
  };
  const total = sumRows(rows);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: 680 }}>
        <thead>
          <tr>
            <TH cls="w-20">구분</TH>
            <TH cls="w-32">명칭</TH>
            <TH cls="w-24">규격</TH>
            <TH cls="w-16">수량</TH>
            <TH cls="w-20">재료비</TH>
            <TH cls="w-20">노무비</TH>
            <TH cls="w-16">경비</TH>
            <TH cls="w-20">단가계</TH>
            <TH cls="w-24">금액</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const unit = rowUnitTotal(r);
            const amt = rowTotal(r);
            return (
              <tr key={r.id}>
                <td className={`border border-slate-200 px-2 py-[5px] text-[10px] font-semibold text-center whitespace-nowrap ${typeStyle[r.category]}`}>
                  {r.category}
                </td>
                <td className="border border-slate-200 px-2 py-[5px] text-xs">{r.name || "-"}</td>
                <td className="border border-slate-200 px-2 py-[5px] text-xs text-slate-500">{r.spec || "-"}</td>
                <ReadCell value={r.quantity} />
                <ReadCell value={r.materialCost || "-"} />
                <ReadCell value={r.laborCost || "-"} />
                <ReadCell value={r.expenseCost || "-"} />
                <ReadCell value={r.unitTotal || (unit ? fmtStr(unit) : "-")} />
                <ReadCell value={r.totalAmount || (amt ? fmtStr(amt) : "-")} />
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={8} className="border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-slate-600 bg-slate-50">
              합 계
            </td>
            <td className="border border-slate-200 px-2 py-1.5 text-right text-xs font-mono font-bold text-slate-800 bg-slate-50">
              {total ? total.toLocaleString() : "-"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <FileImage size={14} className="text-sky-500" />;
  if (type === "application/pdf") return <FileText size={14} className="text-rose-500" />;
  return <File size={14} className="text-slate-500" />;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function NewPriceReviewForm({ quotationItems, quotationFileName, dbTotal, actualSummary, competitorBids }: Props) {
  const [projectName, setProjectName] = useState("");
  const [reviewReason, setReviewReason] = useState("");

  const [basisMarks, setBasisMarks] = useState<Record<string, PriceMark>>({
    contract: "X", db: "X", actual: "X", estimate: "O", unit: "X",
  });
  function cycleMark(key: string) {
    const idx = MARK_CYCLE.indexOf(basisMarks[key] as PriceMark);
    const newMark = MARK_CYCLE[(idx + 1) % MARK_CYCLE.length];
    setBasisMarks(prev => ({ ...prev, [key]: newMark }));
    if (newMark === "O" || newMark === "△") {
      if (key === "db" && dbTotal != null) {
        setDbRows([makeRow({ name: "DB단가 합계", totalAmount: fmtStr(dbTotal) })]);
      } else if (key === "actual" && actualSummary) {
        setActualRows([makeRow({
          name: actualSummary.name ?? "실적단가",
          materialCost: fmtStr(actualSummary.materialCost),
          laborCost: fmtStr(actualSummary.laborCost),
          expenseCost: fmtStr(actualSummary.expenseCost),
          totalAmount: fmtStr(actualSummary.totalCost),
        })]);
      }
    }
  }

  const [newItemName, setNewItemName] = useState(
    quotationItems && quotationItems.length > 0 ? quotationItems[0].itemName : ""
  );

  const [estimateRows, setEstimateRows] = useState<PriceRow[]>(() => {
    if (quotationItems && quotationItems.length > 0)
      return quotationItems.slice(0, 15).map(fromItem);
    return [makeRow()];
  });

  // 단가산정기준 각 항목별 rows (O/△ 선택 시 단가검토에 표시)
  const [contractRows, setContractRows] = useState<PriceRow[]>([makeRow()]);
  const [dbRows, setDbRows] = useState<PriceRow[]>([makeRow()]);
  const [actualRows, setActualRows] = useState<PriceRow[]>([makeRow()]);
  const [unitRows, setUnitRows] = useState<PriceRow[]>(() => {
    if (quotationItems && quotationItems.length > 0) {
      const matched = quotationItems.filter(it => it.marketPrice != null);
      if (matched.length > 0) return matched.slice(0, 15).map(fromItemMarketPrice);
    }
    return [makeRow()];
  });

  function getBasisRows(key: string): { rows: PriceRow[]; setRows: (r: PriceRow[]) => void } | null {
    switch (key) {
      case "contract": return { rows: contractRows, setRows: setContractRows };
      case "db":       return { rows: dbRows,       setRows: setDbRows };
      case "actual":   return { rows: actualRows,   setRows: setActualRows };
      case "estimate": return { rows: estimateRows, setRows: setEstimateRows };
      case "unit":     return { rows: unitRows,     setRows: setUnitRows };
      default: return null;
    }
  }

  const [reviewNotes, setReviewNotes] = useState("");
  const [negotiationResult, setNegotiationResult] = useState("");

  const APPLIED_OPTS = ["종합단가 적용", "견적가 적용", "기계약 단가 적용", "실적 단가 적용", "DB 단가 적용", "일위대가 적용"];
  const [appliedPlan, setAppliedPlan] = useState("종합단가 적용");

  // 종합단가 적용 — 사용자가 단가검토 테이블들에서 체크박스로 선택한 행들이 자동 합쳐짐.
  // 키 형식: `${tableKey}:${rowId}` (예: "contract:5", "db:7")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  function toggleSelect(tableKey: string, rowId: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const key = `${tableKey}:${rowId}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const TABLE_TO_CATEGORY: Record<string, SourceCategory> = {
    contract: "기계약단가",
    db:       "DB단가",
    actual:   "실적단가",
    estimate: "견적가",
    unit:     "일위대가",
  };

  const composedRows: ReviewRow[] = (() => {
    const out: ReviewRow[] = [];
    const tables: Array<{ key: string; rows: PriceRow[] }> = [
      { key: "contract", rows: contractRows },
      { key: "db",       rows: dbRows },
      { key: "actual",   rows: actualRows },
      { key: "estimate", rows: estimateRows },
      { key: "unit",     rows: unitRows },
    ];
    for (const t of tables) {
      const category = TABLE_TO_CATEGORY[t.key];
      if (!category) continue;
      for (const r of t.rows) {
        if (selectedKeys.has(`${t.key}:${r.id}`)) {
          out.push({ ...r, category });
        }
      }
    }
    return out;
  })();

  // 첨부파일
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newFiles: AttachedFile[] = Array.from(files).map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: f.size,
      type: f.type,
      file: f,
    }));
    setAttachedFiles(prev => [...prev, ...newFiles]);
  }

  function removeFile(id: string) {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  }

  const estTotal = sumRows(estimateRows);

  const appliedRows: ReviewRow[] = (() => {
    switch (appliedPlan) {
      case "종합단가 적용":
        return composedRows;
      case "견적가 적용":
        return estimateRows.map(r => ({ ...r, category: "견적가" as SourceCategory }));
      case "기계약 단가 적용":
        return contractRows.map(r => ({ ...r, category: "기계약단가" as SourceCategory }));
      case "실적 단가 적용":
        return actualRows.map(r => ({ ...r, category: "실적단가" as SourceCategory }));
      case "DB 단가 적용":
        return dbRows.map(r => ({ ...r, category: "DB단가" as SourceCategory }));
      case "일위대가 적용":
        return unitRows.map(r => ({ ...r, category: "일위대가" as SourceCategory }));
      default:
        return composedRows;
    }
  })();

  const appliedTotal = sumRows(appliedRows);

  const compareLabel =
    appliedTotal > 0 && estTotal > 0
      ? appliedTotal < estTotal
        ? `적용단가 (${appliedTotal.toLocaleString()}원) < 견적가 (${estTotal.toLocaleString()}원)`
        : appliedTotal > estTotal
          ? `적용단가 (${appliedTotal.toLocaleString()}원) > 견적가 (${estTotal.toLocaleString()}원)`
          : "적용단가 = 견적가"
      : "";

  const basisDefs: Array<{ key: string; label: string }> = [
    { key: "contract", label: "기계약단가" },
    { key: "db",       label: "DB단가" },
    { key: "actual",   label: "실적단가" },
    { key: "estimate", label: "견적가" },
    { key: "unit",     label: "일위대가" },
  ];

  const markColor = (m: PriceMark) =>
    m === "O"  ? "text-blue-600 font-bold" :
    m === "△" ? "text-amber-500 font-semibold" :
                 "text-slate-400";

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-violet-300 via-blue-300 to-sky-300" />

      {/* 헤더 */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 ring-1 ring-violet-200/50">
            <ClipboardList size={16} />
          </span>
          신규 단가 검토서
        </h2>
        <p className="text-xs text-slate-500 mt-1 pl-[2.625rem]">
          신규 적용 단가의 산정 근거와 협의 결과를 기록합니다.
          {quotationFileName && (
            <span className="ml-1.5 text-slate-400">· {quotationFileName}</span>
          )}
        </p>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* PJT명 */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap w-20">PJT명</span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="프로젝트명을 입력하세요"
            className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
          />
        </div>

        {/* 단가검토 사유 */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">단가검토 사유</label>
          <textarea
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            placeholder="단가 검토가 필요한 사유를 입력하세요"
            rows={2}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/40 leading-relaxed"
          />
        </div>

        {/* 단가산정 기준 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-semibold text-slate-700">단가산정 기준</label>
            <span className="text-[10px] text-slate-400">셀 클릭으로 O / △ / X 변경</span>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  {basisDefs.map(({ key, label }) => (
                    <th key={key} className="border border-slate-200 px-8 py-1.5 text-[11px] font-semibold text-slate-500 text-center bg-slate-50 whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {basisDefs.map(({ key }) => (
                    <td
                      key={key}
                      className="border border-slate-200 px-6 py-2 text-center cursor-pointer select-none hover:bg-blue-50/40 transition-colors"
                      onClick={() => cycleMark(key)}
                    >
                      <span className={`text-sm ${markColor(basisMarks[key])}`}>
                        {basisMarks[key] || "—"}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 신규내역명 */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap w-20">신규내역명</span>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="신규 적용 내역명을 입력하세요"
            className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
          />
        </div>

        {/* 단가검토 */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">단가검토</label>

          {/* 단가산정기준에서 O 또는 △ 선택된 항목만 동적으로 표시 */}
          {(() => {
            const active = basisDefs.filter(
              ({ key }) => basisMarks[key] === "O" || basisMarks[key] === "△"
            );
            return active.map(({ key, label }, idx) => {
              const brs = getBasisRows(key);
              if (!brs) return null;
              const mark = basisMarks[key];
              const markBadge =
                mark === "O"
                  ? "text-blue-600 border-blue-300 bg-blue-50"
                  : "text-amber-600 border-amber-300 bg-amber-50";
              return (
                <div key={key}>
                  <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                    {idx + 1}) {label}
                    <span className={`text-[10px] font-bold border rounded px-1 py-0 ${markBadge}`}>
                      {mark}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      · 좌측 체크박스로 종합단가 적용에 포함시킬 항목을 선택
                    </span>
                  </p>
                  <EstimateTable
                    rows={brs.rows}
                    setRows={brs.setRows}
                    tableKey={key}
                    selectedKeys={selectedKeys}
                    onToggleSelect={(rowId) => toggleSelect(key, rowId)}
                  />
                </div>
              );
            });
          })()}

          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="▷ 비고 (예: 노무비 적용 기준, 환산 방법 등)"
            rows={2}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-600 bg-slate-50/50 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>

        {/* 협의결과 */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">협의결과</label>
          {compareLabel && (
            <div className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${appliedTotal < estTotal ? "text-emerald-700" : "text-rose-700"}`}>
              <span className="text-slate-400">▶</span>
              {compareLabel}
            </div>
          )}
          <div className="flex items-start gap-2">
            <span className="text-slate-400 text-xs mt-2.5">▶</span>
            <textarea
              value={negotiationResult}
              onChange={(e) => setNegotiationResult(e.target.value)}
              placeholder="협의 결과 내용을 입력하세요"
              rows={3}
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
          </div>
        </div>

        {/* 적용안 */}
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <label className="text-sm font-semibold text-slate-700">적용안</label>
            <select
              value={appliedPlan}
              onChange={(e) => setAppliedPlan(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            >
              {APPLIED_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {appliedPlan === "종합단가 적용" && composedRows.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-md p-6 text-center text-xs text-slate-400 bg-slate-50/40">
              위 단가검토 테이블의 행 좌측 체크박스로 적용할 항목을 선택하세요.
            </div>
          ) : (
            <AppliedTable rows={appliedRows} />
          )}
        </div>

        {/* 첨부파일 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-sm font-semibold text-slate-700">첨부파일</label>
            <span className="text-[10px] text-slate-400">도면, 실적 자료, 견적서 등 근거 파일을 첨부하세요</span>
          </div>

          {/* 드래그 앤 드롭 영역 */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              isDragOver
                ? "border-blue-400 bg-blue-50/60"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <Paperclip size={20} className="mx-auto mb-2 text-slate-400" />
            <p className="text-xs text-slate-500 font-medium">클릭하거나 파일을 끌어다 놓으세요</p>
            <p className="text-[10px] text-slate-400 mt-1">PDF, 이미지(JPG·PNG), Excel, Word, DWG 등</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.dwg,.docx,.doc,.zip"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* 첨부된 파일 목록 */}
          {attachedFiles.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {attachedFiles.map(f => (
                <li
                  key={f.id}
                  className="flex items-center gap-2.5 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/60 hover:bg-slate-100/60 transition-colors"
                >
                  {fileIcon(f.type)}
                  <span className="text-xs text-slate-700 font-medium flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtSize(f.size)}</span>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="text-slate-300 hover:text-rose-400 transition-colors flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </section>
  );
}
