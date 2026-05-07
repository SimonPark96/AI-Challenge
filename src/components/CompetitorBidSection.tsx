"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send, Upload, ChevronDown, ChevronUp,
  FileText, Clock, TrendingUp, TrendingDown, Minus,
  Loader2, AlertTriangle, Plus,
} from "lucide-react";
import Link from "next/link";

interface QuotationItem {
  id: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  unitPrice: number | null;
  quantity: number | null;
}

interface ReceivedBidItem {
  id: number;
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  totalCost: number | null;
  origItemId: number | null;
  origDeviationPct: number | null;
  matchConfidence: number | null;
}

interface ReceivedBid {
  id: number;
  companyName: string | null;
  fileName: string;
  status: string;
  createdAt: string;
  items: ReceivedBidItem[];
}

interface BidRequest {
  id: number;
  title: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
  workType: { id: number; name: string; parentId: number | null } | null;
  receivedBids: ReceivedBid[];
}

function fmt(n: number | null): string {
  return n != null ? n.toLocaleString() + "원" : "-";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function DevBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400 font-mono">-</span>;
  const abs = Math.abs(pct);
  const sign = pct > 0 ? "+" : "";
  if (abs <= 5) return (
    <span className="inline-flex items-center gap-0.5 text-emerald-700 font-mono font-semibold text-xs">
      <Minus size={11} />{sign}{pct.toFixed(1)}%
    </span>
  );
  if (pct > 0) return (
    <span className="inline-flex items-center gap-0.5 text-rose-600 font-mono font-semibold text-xs">
      <TrendingUp size={11} />{sign}{pct.toFixed(1)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-blue-600 font-mono font-semibold text-xs">
      <TrendingDown size={11} />{pct.toFixed(1)}%
    </span>
  );
}

// 비교 테이블 (원본 항목 기준)
function ComparisonTable({
  origItems,
  receivedItems,
}: {
  origItems: QuotationItem[];
  receivedItems: ReceivedBidItem[];
}) {
  const byOrigId = new Map<number, ReceivedBidItem>();
  for (const ri of receivedItems) {
    if (ri.origItemId !== null) byOrigId.set(ri.origItemId, ri);
  }
  const unmatched = receivedItems.filter((ri) => ri.origItemId === null);

  return (
    <div className="overflow-auto border border-slate-200 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            <th className="text-left p-2 font-medium text-slate-600">원본 항목명</th>
            <th className="text-right p-2 font-medium text-slate-600">원본 단가</th>
            <th className="text-left p-2 font-medium text-blue-600">타사 항목명</th>
            <th className="text-right p-2 font-medium text-blue-600">타사 단가계</th>
            <th className="text-right p-2 font-medium text-slate-600">편차</th>
          </tr>
        </thead>
        <tbody>
          {origItems.map((orig) => {
            const ri = byOrigId.get(orig.id);
            return (
              <tr key={orig.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-2 font-medium text-slate-800 max-w-[160px] truncate" title={orig.itemName}>
                  {orig.itemName}
                  {orig.spec && <span className="text-slate-400 ml-1 font-normal">{orig.spec}</span>}
                </td>
                <td className="p-2 text-right font-mono text-slate-700">{fmt(orig.unitPrice)}</td>
                {ri ? (
                  <>
                    <td className="p-2 text-blue-700 max-w-[160px] truncate" title={ri.itemName}>{ri.itemName}</td>
                    <td className="p-2 text-right font-mono font-semibold text-blue-700">{fmt(ri.totalCost)}</td>
                    <td className="p-2 text-right"><DevBadge pct={ri.origDeviationPct} /></td>
                  </>
                ) : (
                  <td colSpan={3} className="p-2 text-slate-400">매칭 없음</td>
                )}
              </tr>
            );
          })}
          {unmatched.map((ri) => (
            <tr key={`u-${ri.id}`} className="border-t border-slate-100 bg-blue-50/30">
              <td className="p-2 text-slate-400 italic">원본 없음</td>
              <td className="p-2 text-right text-slate-400">-</td>
              <td className="p-2 text-blue-700 max-w-[160px] truncate">{ri.itemName}</td>
              <td className="p-2 text-right font-mono text-blue-700">{fmt(ri.totalCost)}</td>
              <td className="p-2 text-right text-slate-400">-</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 개별 수령 견적 행
function ReceivedBidRow({ bid, origItems }: { bid: ReceivedBid; origItems: QuotationItem[] }) {
  const [open, setOpen] = useState(false);

  const matched = bid.items.filter((i) => i.origItemId !== null).length;
  const avgDev = bid.items.length > 0 && matched > 0
    ? bid.items
        .filter((i) => i.origDeviationPct !== null)
        .reduce((a, i) => a + (i.origDeviationPct ?? 0), 0) /
      bid.items.filter((i) => i.origDeviationPct !== null).length
    : null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition text-left"
      >
        <FileText size={14} className="text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800">{bid.companyName ?? bid.fileName}</span>
          <span className="text-xs text-slate-400 ml-2">{bid.fileName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {avgDev !== null && <DevBadge pct={avgDev} />}
          <span className="text-xs text-slate-400">{matched}/{bid.items.length}항목 매칭</span>
          <span className="text-xs text-slate-400">{fmtDate(bid.createdAt)}</span>
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3">
          <ComparisonTable origItems={origItems} receivedItems={bid.items} />
        </div>
      )}
    </div>
  );
}

// 개별 BidRequest 카드
function BidRequestCard({
  req,
  origItems,
  quotationId,
  onBidReceived,
}: {
  req: BidRequest;
  origItems: QuotationItem[];
  quotationId: number;
  onBidReceived: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (companyName.trim()) fd.append("companyName", companyName.trim());
      const res = await fetch(`/api/bid-request/${req.id}/receive`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onBidReceived();
      setShowUpload(false);
      setCompanyName("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <Send size={13} className="text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-700">{req.title ?? "견적 요청"}</span>
        <span className="text-xs text-slate-400">{fmtDate(req.sentAt)}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
          req.status === "received" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
        }`}>
          {req.status === "received" ? "수령완료" : "발송완료"}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* 수령 견적 목록 */}
        {req.receivedBids.length > 0 ? (
          <div className="space-y-2">
            {req.receivedBids.map((bid) => (
              <ReceivedBidRow key={bid.id} bid={bid} origItems={origItems} />
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock size={12} /> 수령된 견적서가 없습니다.
          </div>
        )}

        {/* 견적 수령 업로드 */}
        {!showUpload ? (
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded transition"
          >
            <Plus size={12} /> 견적서 수령
          </button>
        ) : (
          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-700">타사 견적서 업로드</div>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="업체명 (없으면 파일명 사용)"
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
            />
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded p-3 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
              {uploading ? (
                <span className="text-xs text-blue-600 inline-flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> 분석 중...
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  <Upload size={12} className="inline mr-1" />XLSX · XLS · CSV 업로드
                </span>
              )}
            </div>
            {uploadError && (
              <div className="text-xs text-rose-600 flex items-center gap-1">
                <AlertTriangle size={11} /> {uploadError}
              </div>
            )}
            <button onClick={() => { setShowUpload(false); setUploadError(null); }}
              className="text-xs text-slate-400 hover:text-slate-600">취소</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 섹션 ──────────────────────────────────────────────────
export function CompetitorBidSection({ quotationId }: { quotationId: number }) {
  const [bidRequests, setBidRequests] = useState<BidRequest[]>([]);
  const [origItems, setOrigItems] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quote/${quotationId}/bid-requests`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBidRequests(data.bidRequests ?? []);
      setOrigItems(data.quotationItems ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Send size={16} className="text-blue-500" />
            3사 견적 비교 단가 이력
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            3사 견적 요청 페이지에서 발송한 요청과 수령된 타사 견적을 원본과 비교합니다.
          </p>
        </div>
        <Link
          href={`/bid-request?quotationId=${quotationId}`}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Send size={13} /> 3사 견적 요청
        </Link>
      </div>

      {loading && (
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" /> 불러오는 중...
        </div>
      )}

      {error && (
        <div className="text-xs text-rose-600 flex items-center gap-1">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {!loading && bidRequests.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
          <Send size={32} className="text-slate-200 mx-auto" />
          <p className="text-sm text-slate-400">발송된 3사 견적 요청이 없습니다.</p>
          <Link
            href={`/bid-request?quotationId=${quotationId}`}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 px-4 py-2 rounded-lg transition"
          >
            <Send size={13} /> 3사 견적 요청하기
          </Link>
        </div>
      )}

      {!loading && bidRequests.length > 0 && (
        <div className="space-y-3">
          {bidRequests.map((req) => (
            <BidRequestCard
              key={req.id}
              req={req}
              origItems={origItems}
              quotationId={quotationId}
              onBidReceived={load}
            />
          ))}
        </div>
      )}
    </section>
  );
}
