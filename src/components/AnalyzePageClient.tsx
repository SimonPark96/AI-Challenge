"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  Sparkles,
  Building2,
  CheckCircle2,
  Clock,
  ChevronDown,
  FileText,
  Search,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useRequestStore, type AnalyzeTab } from "@/lib/stores/request-store";
import { AnalyzeBrowserTabs } from "./AnalyzeBrowserTabs";
import { QuoteSummary } from "./QuoteSummary";
import { TotalComparison } from "./TotalComparison";
import { AICommentary } from "./AICommentary";
import { ComparisonTable } from "./ComparisonTable";

// ── Types ──────────────────────────────────────────

interface QuotationInfo {
  id: number;
  fileName: string;
  uploadedAt: string | Date;
  status: string;
  aiCommentary: string | null;
  aiCommentaryAt: string | Date | null;
}

interface PriceSummaryInfo {
  id: number;
  name: string;
  spec: string | null;
  unit: string | null;
  totalCost: number | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  sourceFile: string | null;
  sourceVia: string | null;
}

interface PriceSummaryCandidate extends PriceSummaryInfo {
  projectName?: string | null;
  confidence: number;
  method: "embedding" | "deterministic";
}

interface ConfItem {
  id: number;
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  confUnitPrice: number | null;
  matchedConfidence: number | null;
  deviationPct: number | null;
}

interface CompetitorBid {
  id: number;
  companyName: string | null;
  totalCost: number | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
}

interface MatchedItem {
  id: number;
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  matchedConfidence: number | null;
  marketPrice: number | null;
  marketRegion: string | null;
  deviationPct: number | null;
  matchedSource: "price" | "wage" | null;
  matchedPrice: {
    itemName: string;
    spec: string | null;
    source: string;
    region: string | null;
  } | null;
  matchedWage: {
    jobName: string;
    cateCd: string;
    source: string;
    unit: string | null;
    basis: string | null;
  } | null;
}

interface CostBreakdown {
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
}

interface BidApiReceivedBid {
  id: number;
  companyName: string | null;
  status: string;
  fileName: string;
  items: {
    materialCost: number | null;
    laborCost: number | null;
    expenseCost: number | null;
    totalCost: number | null;
  }[];
}

interface BidApiRequest {
  id: number;
  title: string | null;
  status: string;
  sentAt: string | null;
  companyName: string | null;
  workType: { id: number; name: string } | null;
  quotation: { id: number; fileName: string } | null;
  receivedBids: BidApiReceivedBid[];
}

interface BidGroup {
  key: string;
  title: string | null;
  sentAt: string | null;
  workType: { id: number; name: string } | null;
  requests: BidApiRequest[];
}

export interface BidCard {
  id: number;
  companyName: string | null;
  fileName: string;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  totalCost: number | null;
}

export interface AnalyzePageClientProps {
  quotation: QuotationInfo;
  meta: Record<string, unknown> | null;
  partnerTotal: number | null;
  partnerCostBreakdown: CostBreakdown;
  priceSummary: PriceSummaryInfo | null;
  confItems: ConfItem[];
  confTotal: number | null;
  confMatchedCount: number;
  competitorBids: CompetitorBid[];
  itemMarketTotal: number | null;
  itemMarketBreakdown: CostBreakdown;
  itemTotalCount: number;
  itemMatchedCount: number;
  matchedItems: MatchedItem[];
  quotationName: string | null;
  quotationSpec: string | null;
  /** 확정 페이지에서는 단가 합계 비교·AI 코멘트 숨김 */
  hideComparison?: boolean;
  /** 마운트 시 강제로 활성화할 탭. 분석 페이지는 "db" 로 진입 시 항상 사내 DB 단가 활성화. */
  forceInitialTab?: AnalyzeTab;
  /** 종합 탭 하단에 [검토 결과 확정] 트리거 버튼 표시 (결과 확정 페이지 전용) */
  showConfirmTrigger?: boolean;
}

// ── Helpers ────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() + "원" : "-";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}.${String(kst.getUTCDate()).padStart(2, "0")} ${String(
    kst.getUTCHours()
  ).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
}

function DevBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400">-</span>;
  const abs = Math.abs(pct);
  const sign = pct > 0 ? "+" : "";
  if (abs <= 5)
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-700 font-mono font-semibold text-xs">
        <Minus size={12} />
        {sign}
        {pct.toFixed(1)}%
      </span>
    );
  if (pct > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-600 font-mono font-semibold text-xs">
        <TrendingUp size={12} />
        {sign}
        {pct.toFixed(1)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-blue-600 font-mono font-semibold text-xs">
      <TrendingDown size={12} />
      {pct.toFixed(1)}%
    </span>
  );
}

function ConfBadge({ conf }: { conf: number }) {
  const pct = Math.round(conf * 100);
  const cls =
    pct >= 70
      ? "bg-emerald-100 text-emerald-700"
      : pct >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold tabular-nums ${cls}`}
    >
      {pct}%
    </span>
  );
}

function CostRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          bold
            ? "font-bold text-slate-800 font-mono"
            : "text-slate-700 font-mono"
        }
      >
        {value}
      </span>
    </div>
  );
}

function SaveBar({
  onSave,
  saving,
  savedMsg,
  disabled,
}: {
  onSave: () => void;
  saving: boolean;
  savedMsg: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
      {savedMsg && (
        <span
          className={`text-xs font-medium ${
            savedMsg.startsWith("오류") ? "text-rose-600" : "text-emerald-600"
          }`}
        >
          {savedMsg}
        </span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="inline-flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-50"
      >
        <Save size={14} />
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}

// 엑셀 스타일 facet 드롭다운 입력
function FacetInput({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const t = value.trim().toLowerCase();
    return t ? options.filter((o) => o.toLowerCase().includes(t)) : options;
  }, [options, value]);

  return (
    <div ref={ref} className="relative">
      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
        {label}
      </label>
      <div className="flex items-stretch">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => options.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "전체"}
          className="flex-1 min-w-0 border border-r-0 border-slate-300 rounded-l px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:z-10"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`border border-slate-300 rounded-r px-2 py-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition ${
            open ? "bg-slate-100" : ""
          }`}
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {value.trim() && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 border-b border-slate-100"
              >
                전체 (초기화)
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 transition truncate ${
                  value === o
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-700"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab panels ────────────────────────────────────

function SummaryTab({
  quotation,
  meta,
  partnerTotal,
  partnerCostBreakdown,
  priceSummary,
  confTotal,
  confMatchedCount,
  competitorBids,
  itemMarketTotal,
  itemMarketBreakdown,
  itemTotalCount,
  itemMatchedCount,
  hideComparison,
  showConfirmTrigger,
}: Omit<
  AnalyzePageClientProps,
  "confItems" | "matchedItems" | "quotationName" | "quotationSpec"
> & { showConfirmTrigger?: boolean }) {
  return (
    <div className="space-y-6">
      <QuoteSummary quotation={quotation} meta={meta} />
      {!hideComparison && (
        <>
          <TotalComparison
            partnerTotal={partnerTotal}
            partnerCostBreakdown={partnerCostBreakdown}
            summary={priceSummary}
            confTotal={confTotal}
            confMatchedCount={confMatchedCount}
            competitorBids={competitorBids}
            itemMarketTotal={itemMarketTotal}
            itemMarketBreakdown={itemMarketBreakdown}
            itemTotalCount={itemTotalCount}
            itemMatchedCount={itemMatchedCount}
          />
          <AICommentary
            quotationId={quotation.id}
            initialCommentary={quotation.aiCommentary}
            initialCommentaryAt={quotation.aiCommentaryAt}
          />
          {showConfirmTrigger && (
            <div className="flex justify-end">
              <Link
                href={`/confirm/${quotation.id}`}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded text-sm font-semibold shadow-sm transition"
              >
                <CheckCircle2 size={16} /> 검토 결과 확정
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── DB단가 탭 ──────────────────────────────────────

function DbTab({ confItems }: { confItems: ConfItem[] }) {
  const matched = confItems.filter((it) => it.confUnitPrice != null);
  const partnerMatchedTotal = matched.reduce(
    (a, it) => a + (it.unitPrice ?? 0) * (it.quantity ?? 1),
    0
  );
  const confMatchedTotal = matched.reduce(
    (a, it) => a + (it.confUnitPrice ?? 0) * (it.quantity ?? 1),
    0
  );
  const devTotal =
    confMatchedTotal > 0
      ? ((partnerMatchedTotal - confMatchedTotal) / confMatchedTotal) * 100
      : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Lock size={18} className="text-slate-500" /> 사내 DB 단가 검토 결과
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          협력사 견적 항목을 사내 DB 단가와 항목별로 비교합니다.
        </p>
      </div>

      {matched.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              {
                label: "협력사 합계 (매칭항목)",
                val: partnerMatchedTotal,
                badge: undefined as number | undefined,
                cls: "text-slate-800",
              },
              {
                label: "사내 DB 단가 합계",
                val: confMatchedTotal,
                badge: undefined,
                cls: "text-slate-800 font-semibold",
              },
              {
                label: "편차",
                val: null,
                badge: devTotal ?? undefined,
                cls: "",
              },
            ] as {
              label: string;
              val: number | null;
              badge: number | undefined;
              cls: string;
            }[]
          ).map(({ label, val, badge, cls }) => (
            <div
              key={label}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3"
            >
              <div className="text-[11px] text-slate-400 mb-1">{label}</div>
              {badge !== undefined ? (
                <div className="text-sm font-bold">
                  <DevBadge pct={badge} />
                </div>
              ) : (
                <div className={`text-sm font-mono font-bold ${cls}`}>
                  {val != null && val > 0 ? fmt(val) : "-"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {matched.length === 0 ? (
        <div className="text-xs text-slate-500 border border-slate-200 bg-slate-50 rounded p-3">
          사내 DB와 매칭된 항목이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium text-slate-600 text-xs">
                  항목명
                </th>
                <th className="text-left p-2 font-medium text-slate-600 text-xs">
                  규격
                </th>
                <th className="text-right p-2 font-medium text-slate-600 text-xs">
                  수량
                </th>
                <th className="text-right p-2 font-medium text-slate-600 text-xs">
                  협력사 단가
                </th>
                <th className="text-right p-2 font-medium text-slate-600 text-xs">
                  사내 DB 단가
                </th>
                <th className="text-right p-2 font-medium text-slate-600 text-xs">
                  편차
                </th>
                <th className="text-center p-2 font-medium text-slate-600 text-xs">
                  신뢰도
                </th>
              </tr>
            </thead>
            <tbody>
              {matched.map((it) => {
                const dev =
                  it.confUnitPrice != null &&
                  it.unitPrice != null &&
                  it.unitPrice !== 0
                    ? ((it.unitPrice - it.confUnitPrice) / it.confUnitPrice) *
                      100
                    : null;
                return (
                  <tr
                    key={it.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td
                      className="p-2 text-slate-800 font-medium max-w-[180px] truncate"
                      title={it.itemName}
                    >
                      {it.itemName}
                    </td>
                    <td className="p-2 text-slate-500 text-xs max-w-[120px] truncate">
                      {it.spec ?? "-"}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-500 text-xs">
                      {it.quantity ?? "-"}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-700">
                      {fmt(it.unitPrice)}
                    </td>
                    <td className="p-2 text-right font-mono font-semibold text-slate-800">
                      {fmt(it.confUnitPrice)}
                    </td>
                    <td className="p-2 text-right">
                      <DevBadge pct={dev} />
                    </td>
                    <td className="p-2 text-center">
                      {it.matchedConfidence != null ? (
                        <ConfBadge conf={it.matchedConfidence} />
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td
                  colSpan={3}
                  className="p-2 text-xs font-semibold text-slate-600"
                >
                  합계
                </td>
                <td className="p-2 text-right font-mono font-bold text-slate-800">
                  {fmt(partnerMatchedTotal)}
                </td>
                <td className="p-2 text-right font-mono font-bold text-slate-800">
                  {fmt(confMatchedTotal)}
                </td>
                <td className="p-2 text-right">
                  <DevBadge pct={devTotal} />
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

// ── 실적단가 탭 ────────────────────────────────────

function ActualTab({
  quotationId,
  priceSummary,
  partnerTotal,
  quotationName,
  quotationSpec,
}: {
  quotationId: number;
  priceSummary: PriceSummaryInfo | null;
  partnerTotal: number | null;
  quotationName: string | null;
  quotationSpec: string | null;
}) {
  const router = useRouter();
  const [filterBizDiv, setFilterBizDiv] = useState("");
  const [filterProjName, setFilterProjName] = useState("");
  const [filterName, setFilterName] = useState(quotationName ?? "");
  const [filterSpec, setFilterSpec] = useState(quotationSpec ?? "");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [candidates, setCandidates] = useState<PriceSummaryCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // facet 옵션 (드롭다운용)
  const [bizDivOptions, setBizDivOptions] = useState<string[]>([]);
  const [projNameOptions, setProjNameOptions] = useState<string[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(
    priceSummary?.id ?? null
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // facets 로드
  useEffect(() => {
    fetch("/api/price-summary/facets")
      .then((r) => r.json())
      .then((d) => {
        setBizDivOptions(d.businessDivisions ?? []);
        setProjNameOptions(d.projectNames ?? []);
      })
      .catch(() => {});
  }, []);

  // 이름·규격 옵션 = 현재 candidates에서 추출
  const nameOptions = useMemo(
    () => [...new Set(candidates.map((c) => c.name).filter(Boolean))],
    [candidates]
  );
  const specOptions = useMemo(
    () => [
      ...new Set(
        candidates.map((c) => c.spec).filter((v): v is string => Boolean(v))
      ),
    ],
    [candidates]
  );

  async function search() {
    const name = filterName.trim();
    if (!name) {
      setFetched(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/price-summary/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          spec: filterSpec.trim() || undefined,
          businessDivision: filterBizDiv.trim() || undefined,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined,
        }),
      });
      const data = await res.json();
      const list: PriceSummaryCandidate[] = Array.isArray(data?.candidates)
        ? data.candidates
        : [];
      setCandidates(list);
      if (list.length > 0 && !list.some((c) => c.id === priceSummary?.id)) {
        setSelectedId(list[0].id);
      }
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  useEffect(() => {
    search();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    setFilterBizDiv("");
    setFilterProjName("");
    setFilterName(quotationName ?? "");
    setFilterSpec(quotationSpec ?? "");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  const displayList = useMemo(() => {
    let list: PriceSummaryCandidate[] =
      candidates.length > 0
        ? candidates
        : priceSummary
        ? [{ ...priceSummary, confidence: 0, method: "deterministic" as const }]
        : [];
    if (filterProjName.trim()) {
      const t = filterProjName.trim().toLowerCase();
      list = list.filter((c) => c.projectName?.toLowerCase().includes(t));
    }
    return list;
  }, [candidates, priceSummary, filterProjName]);

  async function handleSave() {
    if (selectedId == null) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch(`/api/quote/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceSummaryId: selectedId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSavedMsg("저장되었습니다. 종합 탭에서 확인하세요.");
      router.refresh();
    } catch (e) {
      setSavedMsg(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Wallet size={18} className="text-blue-500" /> 실적단가 검토 결과{" "}
          <Sparkles size={14} className="text-blue-400" />
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          카드를 클릭하여 원하는 실적단가를 선택한 뒤 저장하면 종합 탭에
          반영됩니다.
        </p>
      </div>

      {/* 필터 */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <FacetInput
            label="본부명"
            value={filterBizDiv}
            onChange={setFilterBizDiv}
            options={bizDivOptions}
          />
          <FacetInput
            label="프로젝트명"
            value={filterProjName}
            onChange={setFilterProjName}
            options={projNameOptions}
          />
          <FacetInput
            label="이름"
            value={filterName}
            onChange={setFilterName}
            options={nameOptions}
            placeholder="공사명 입력"
          />
          <FacetInput
            label="규격"
            value={filterSpec}
            onChange={setFilterSpec}
            options={specOptions}
            placeholder="규격 입력"
          />
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              기간
            </label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="flex-1 min-w-0 border border-slate-300 rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-slate-400 text-xs shrink-0">~</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="flex-1 min-w-0 border border-slate-300 rounded px-1.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded transition hover:bg-slate-100"
          >
            <RotateCcw size={11} /> 초기화
          </button>
          <button
            type="button"
            onClick={search}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded transition disabled:opacity-50"
          >
            <Search size={11} /> {loading ? "검색 중..." : "검색"}
          </button>
        </div>
      </div>

      {/* 결과 카드 */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <span className="animate-spin inline-block w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full" />
          실적단가 후보를 검색 중입니다…
        </div>
      ) : !fetched || displayList.length === 0 ? (
        <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded p-3">
          {filterName.trim()
            ? "검색 조건에 맞는 실적단가 데이터가 없습니다."
            : "공사명을 입력하고 검색하면 실적단가를 추천합니다."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayList.map((c) => {
            const isSelected = selectedId === c.id;
            const isCurrent = priceSummary?.id === c.id;
            const devPct =
              partnerTotal != null && c.totalCost != null && c.totalCost !== 0
                ? ((partnerTotal - c.totalCost) / c.totalCost) * 100
                : null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`text-left rounded-lg p-4 transition ${
                  isSelected
                    ? "border-2 border-blue-500 bg-blue-50/60 shadow-sm ring-2 ring-blue-200"
                    : "border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                        <CheckCircle2 size={10} /> 선택됨
                      </span>
                    )}
                    {isCurrent && !isSelected && (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        현재 저장
                      </span>
                    )}
                    {candidates.length > 0 && c.confidence > 0 && (
                      <ConfBadge conf={c.confidence} />
                    )}
                  </div>
                  {devPct !== null && <DevBadge pct={devPct} />}
                </div>
                <div
                  className="font-semibold text-slate-800 text-sm truncate"
                  title={c.name}
                >
                  {c.name}
                </div>
                {c.spec && (
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    {c.spec}
                    {c.unit ? ` / ${c.unit}` : ""}
                  </div>
                )}
                {c.projectName && (
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    📁 {c.projectName}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                  <CostRow label="합계" value={fmt(c.totalCost)} bold />
                  <CostRow label="재료비" value={fmt(c.materialCost)} />
                  <CostRow label="노무비" value={fmt(c.laborCost)} />
                  <CostRow label="경비" value={fmt(c.expenseCost)} />
                </div>
                {c.sourceFile && (
                  <div
                    className="text-[11px] text-slate-400 mt-2 truncate"
                    title={c.sourceFile}
                  >
                    출처: {c.sourceFile}
                    {c.sourceVia ? ` (${c.sourceVia})` : ""}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <SaveBar
        onSave={handleSave}
        saving={saving}
        savedMsg={savedMsg}
        disabled={selectedId == null || selectedId === priceSummary?.id}
      />
    </section>
  );
}

// ── 비교 견적 탭 ────────────────────────────────────

function BidTab({
  quotationId,
  partnerTotal,
  cards,
  onCardsChange,
}: {
  quotationId: number;
  partnerTotal: number | null;
  cards: BidCard[];
  onCardsChange: (cards: BidCard[]) => void;
}) {
  const router = useRouter();
  const [bidRequests, setBidRequests] = useState<BidApiRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/bid-request")
      .then((r) => r.json())
      .then((d) => setBidRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const bidGroups = useMemo<BidGroup[]>(() => {
    const groups: BidGroup[] = [];
    for (const req of bidRequests) {
      const reqTime = req.sentAt ? new Date(req.sentAt).getTime() : 0;
      const match = groups.find((g) => {
        const gTime = g.sentAt ? new Date(g.sentAt).getTime() : 0;
        return (
          g.title === req.title &&
          g.workType?.id === req.workType?.id &&
          Math.abs(gTime - reqTime) < 60_000
        );
      });
      if (match) match.requests.push(req);
      else
        groups.push({
          key: `${req.title ?? ""}_${req.workType?.id ?? 0}_${
            req.sentAt ?? req.id
          }`,
          title: req.title,
          sentAt: req.sentAt,
          workType: req.workType,
          requests: [req],
        });
    }
    return groups;
  }, [bidRequests]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  function addCard(bid: BidApiReceivedBid) {
    if (cards.length >= 3 || cards.some((c) => c.id === bid.id)) return;
    const cost = bid.items[0] ?? null;
    const sumTotal = bid.items.reduce((a, it) => a + (it.totalCost ?? 0), 0);
    const totalCost = (sumTotal || cost?.totalCost) ?? null;
    onCardsChange([
      ...cards,
      {
        id: bid.id,
        companyName: bid.companyName,
        fileName: bid.fileName,
        materialCost: cost?.materialCost ?? null,
        laborCost: cost?.laborCost ?? null,
        expenseCost: cost?.expenseCost ?? null,
        totalCost,
      },
    ]);
    setSavedMsg(null);
  }

  function removeCard(id: number) {
    onCardsChange(cards.filter((c) => c.id !== id));
    setSavedMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const payload = cards.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        totalCost: c.totalCost,
        materialCost: c.materialCost,
        laborCost: c.laborCost,
        expenseCost: c.expenseCost,
      }));
      const res = await fetch(`/api/quote/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorBids: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSavedMsg("저장되었습니다. 종합 탭에서 확인하세요.");
      router.refresh();
    } catch (e) {
      setSavedMsg(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const BidFileBtn = ({ bid }: { bid: BidApiReceivedBid }) => {
    const added = cards.some((c) => c.id === bid.id);
    const canAdd = !added && cards.length < 3;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (canAdd) addCard(bid);
        }}
        disabled={!canAdd && !added}
        title={
          added ? "이미 추가됨" : canAdd ? "클릭하여 카드 추가" : "카드 가득 참"
        }
        className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded max-w-[170px] truncate transition ${
          added
            ? "bg-violet-100 border border-violet-300 text-violet-700 cursor-default"
            : canAdd
            ? "bg-slate-100 border border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 cursor-pointer"
            : "bg-slate-50 border border-slate-100 text-slate-300 cursor-not-allowed"
        }`}
      >
        <FileText size={10} className="shrink-0" />
        {bid.fileName}
      </button>
    );
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Building2 size={18} className="text-violet-500" /> 비교 견적
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          발송 이력에서 첨부파일을 클릭하면 비교 카드가 생성됩니다. 최대 3개,
          저장하면 종합 탭에 반영됩니다.
        </p>
      </div>

      {/* 비교 카드 */}
      {cards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">
              비교 카드
            </span>
            <span className="text-xs text-slate-400">({cards.length}/3)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((card) => {
              const devPct =
                partnerTotal != null &&
                card.totalCost != null &&
                card.totalCost !== 0
                  ? ((partnerTotal - card.totalCost) / card.totalCost) * 100
                  : null;
              return (
                <div
                  key={card.id}
                  className="rounded-lg border-2 border-violet-300 bg-violet-50/40 p-4 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeCard(card.id)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition"
                    title="카드 제거"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex items-start justify-between gap-2 mb-1 pr-5">
                    <span className="text-xs font-semibold text-violet-700 truncate">
                      {card.companyName ?? "업체명 미상"}
                    </span>
                    {devPct !== null && <DevBadge pct={devPct} />}
                  </div>
                  <div
                    className="text-[11px] text-slate-400 truncate mb-3"
                    title={card.fileName}
                  >
                    {card.fileName}
                  </div>
                  <div className="space-y-1 pt-2 border-t border-violet-200">
                    <CostRow label="합계" value={fmt(card.totalCost)} bold />
                    <CostRow label="재료비" value={fmt(card.materialCost)} />
                    <CostRow label="노무비" value={fmt(card.laborCost)} />
                    <CostRow label="경비" value={fmt(card.expenseCost)} />
                  </div>
                </div>
              );
            })}
          </div>
          <SaveBar
            onSave={handleSave}
            saving={saving}
            savedMsg={savedMsg}
            disabled={cards.length === 0}
          />
        </div>
      )}

      {/* 발송 이력 */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
          <span className="animate-spin inline-block w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full" />
          발송 이력을 불러오는 중입니다…
        </div>
      ) : bidGroups.length === 0 ? (
        <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded p-3">
          발송된 견적 요청 이력이 없습니다. 비교 견적 요청 메뉴에서 먼저 견적을
          발송해주세요.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Clock size={14} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">
              발송 이력
            </span>
            <span className="text-xs text-slate-400">
              ({bidGroups.length}건)
            </span>
            {cards.length < 3 ? (
              <span className="ml-auto text-[11px] text-violet-500 font-medium">
                첨부파일 클릭 시 카드 추가 ({3 - cards.length}개 가능)
              </span>
            ) : (
              <span className="ml-auto text-[11px] text-slate-400">
                카드 3개 가득 참
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-8" />
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-600">
                    수신처
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-600 w-28">
                    공종
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-600">
                    제목
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-600 w-36">
                    발송일시
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-600 w-28">
                    상태
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-600 w-48">
                    첨부파일
                  </th>
                </tr>
              </thead>
              <tbody>
                {bidGroups.map((group) => {
                  const isMulti = group.requests.length > 1;
                  const isExpanded = expandedGroups.has(group.key);
                  const first = group.requests[0];
                  const allBids = group.requests.flatMap((r) => r.receivedBids);
                  const allReceived = group.requests.every(
                    (r) => r.status === "received"
                  );
                  const someReceived = group.requests.some(
                    (r) => r.status === "received"
                  );
                  return (
                    <Fragment key={group.key}>
                      <tr
                        className={`border-t border-slate-100 hover:bg-slate-50 transition ${
                          isMulti ? "cursor-pointer select-none" : ""
                        }`}
                        onClick={
                          isMulti ? () => toggleGroup(group.key) : undefined
                        }
                      >
                        <td className="px-3 py-3 text-center">
                          {isMulti && (
                            <ChevronDown
                              size={13}
                              className={`text-slate-400 transition-transform mx-auto ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-800 text-xs">
                          {isMulti ? (
                            <span className="flex items-center gap-1.5">
                              {first.companyName ?? "-"}
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                                외 {group.requests.length - 1}개사
                              </span>
                            </span>
                          ) : (
                            first.companyName ?? "-"
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {group.workType?.name ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {group.title ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-center text-xs font-mono text-slate-400">
                          {fmtDate(group.sentAt)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              allReceived
                                ? "bg-emerald-100 text-emerald-700"
                                : someReceived
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {allReceived && <CheckCircle2 size={10} />}
                            {allReceived
                              ? "수령완료"
                              : someReceived
                              ? "일부수령"
                              : "발송완료"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            {allBids.map((bid) => (
                              <BidFileBtn key={bid.id} bid={bid} />
                            ))}
                            {allBids.length === 0 && (
                              <span className="text-xs text-slate-300">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isMulti &&
                        isExpanded &&
                        group.requests.map((r) => (
                          <tr
                            key={`sub-${r.id}`}
                            className="border-t border-slate-50 bg-slate-50/60"
                          >
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5 pl-8">
                              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                {r.companyName ?? "-"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-400">
                              {r.workType?.name ?? "-"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-400">
                              {r.title ?? "-"}
                            </td>
                            <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-400">
                              {fmtDate(r.sentAt)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  r.status === "received"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {r.status === "received"
                                  ? "수령완료"
                                  : "발송완료"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="inline-flex flex-col items-center gap-1">
                                {r.receivedBids.map((bid) => (
                                  <BidFileBtn key={bid.id} bid={bid} />
                                ))}
                                {r.receivedBids.length === 0 && (
                                  <span className="text-xs text-slate-300">
                                    -
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ── AI매칭단가 탭 헤더 요약 ────────────────────────

function AiMatchingSummary({ items }: { items: MatchedItem[] }) {
  const partnerSum = items.reduce(
    (a, it) => a + (it.unitPrice ?? 0) * (it.quantity ?? 1),
    0
  );
  const marketSum = items.reduce(
    (a, it) =>
      it.marketPrice != null ? a + it.marketPrice * (it.quantity ?? 1) : a,
    0
  );
  const hasMarket = items.some((it) => it.marketPrice != null);
  const devPct =
    hasMarket && marketSum > 0 && partnerSum > 0
      ? ((partnerSum - marketSum) / marketSum) * 100
      : null;

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {(
        [
          {
            label: "협력사 합계",
            val: partnerSum,
            badge: undefined as number | undefined,
            cls: "text-slate-800",
          },
          {
            label: "시장단가 합계",
            val: hasMarket && marketSum > 0 ? marketSum : null,
            badge: undefined,
            cls: "text-blue-700 font-semibold",
          },
          {
            label: "편차 (협력사 vs 시장)",
            val: null,
            badge: devPct ?? undefined,
            cls: "",
          },
        ] as {
          label: string;
          val: number | null;
          badge: number | undefined;
          cls: string;
        }[]
      ).map(({ label, val, badge, cls }) => (
        <div
          key={label}
          className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3"
        >
          <div className="text-[11px] text-slate-400 mb-1">{label}</div>
          {badge !== undefined ? (
            <div className="text-sm font-bold">
              <DevBadge pct={badge} />
            </div>
          ) : (
            <div className={`text-sm font-mono font-bold ${cls}`}>
              {val != null ? fmt(val) : "-"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main export ────────────────────────────────────

export function AnalyzePageClient(props: AnalyzePageClientProps) {
  const activeTab = useRequestStore((s) => s.activeAnalyzeTab);
  const setActiveTab = useRequestStore((s) => s.setActiveAnalyzeTab);
  const {
    quotation,
    meta,
    partnerTotal,
    partnerCostBreakdown,
    priceSummary,
    confItems,
    confTotal,
    confMatchedCount,
    competitorBids,
    itemMarketTotal,
    itemMarketBreakdown,
    itemTotalCount,
    itemMatchedCount,
    matchedItems,
    quotationName,
    quotationSpec,
    hideComparison,
    forceInitialTab,
    showConfirmTrigger,
  } = props;

  // 분석 페이지는 진입할 때마다 항상 "사내 DB 단가" 탭이 먼저 활성화되도록 강제.
  useEffect(() => {
    if (forceInitialTab) setActiveTab(forceInitialTab);
    // mount 시 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 비교 견적 카드 — 탭 이동 시에도 유지되도록 부모에서 관리
  const [bidCards, setBidCards] = useState<BidCard[]>([]);

  return (
    <div>
      <AnalyzeBrowserTabs />
      <div className="bg-white border border-slate-300 border-t-0 rounded-b-lg p-6 min-h-[300px]">
        {activeTab === "summary" && (
          <SummaryTab
            quotation={quotation}
            meta={meta}
            partnerTotal={partnerTotal}
            partnerCostBreakdown={partnerCostBreakdown}
            priceSummary={priceSummary}
            confTotal={confTotal}
            confMatchedCount={confMatchedCount}
            competitorBids={competitorBids}
            itemMarketTotal={itemMarketTotal}
            itemMarketBreakdown={itemMarketBreakdown}
            itemTotalCount={itemTotalCount}
            itemMatchedCount={itemMatchedCount}
            hideComparison={hideComparison}
            showConfirmTrigger={showConfirmTrigger}
          />
        )}
        {activeTab === "db" && <DbTab confItems={confItems} />}
        {activeTab === "actual" && (
          <ActualTab
            quotationId={quotation.id}
            priceSummary={priceSummary}
            partnerTotal={partnerTotal}
            quotationName={quotationName}
            quotationSpec={quotationSpec}
          />
        )}
        {activeTab === "bid" && (
          <BidTab
            quotationId={quotation.id}
            partnerTotal={partnerTotal}
            cards={bidCards}
            onCardsChange={setBidCards}
          />
        )}
        {activeTab === "ai-matching" &&
          (matchedItems.length > 0 ? (
            <>
              <AiMatchingSummary items={matchedItems} />
              <ComparisonTable
                quotationId={quotation.id}
                items={matchedItems}
              />
            </>
          ) : (
            <p className="text-sm text-slate-400 py-12 text-center">
              AI 매칭 결과가 없습니다.
            </p>
          ))}
      </div>
    </div>
  );
}
