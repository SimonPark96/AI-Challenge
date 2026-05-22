"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Send, Clock, FileText, Plus, Upload,
  Loader2, AlertTriangle, CheckCircle2, X,
  ChevronDown, SlidersHorizontal, RotateCcw, Check,
} from "lucide-react";
import { useRequestStore } from "@/lib/stores/request-store";

interface ReceivedBidItem {
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  totalCost: number | null;
}

interface ReceivedBid {
  id: number;
  companyName: string | null;
  fileName: string;
  status: string;
  items: ReceivedBidItem[];
}

interface BidRequest {
  id: number;
  title: string | null;
  status: string;
  sentAt: string | null;
  companyName: string | null;
  workType: { id: number; name: string } | null;
  quotation: { id: number; fileName: string } | null;
  receivedBids: ReceivedBid[];
}

interface BidGroup {
  key: string;
  title: string | null;
  sentAt: string | null;
  workType: { id: number; name: string } | null;
  quotation: { id: number; fileName: string } | null;
  requests: BidRequest[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, "0")}.${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function ReceiveModal({
  bidRequestId,
  onDone,
  onClose,
}: {
  bidRequestId: number;
  onDone: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (companyName.trim()) fd.append("companyName", companyName.trim());
      const res = await fetch(`/api/bid-request/${bidRequestId}/receive`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDone(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">타사 견적서 수령</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <p className="text-sm text-slate-700 font-medium">업로드 완료</p>
            <button onClick={onClose} className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">확인</button>
          </div>
        ) : (
          <>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="업체명 (없으면 파일명 사용)"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition"
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {uploading ? (
                <span className="text-xs text-blue-600 inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> 분석 중...</span>
              ) : (
                <span className="text-xs text-slate-400"><Upload size={12} className="inline mr-1" />XLSX · XLS · CSV 업로드</span>
              )}
            </div>
            {error && <div className="text-xs text-rose-600 flex items-center gap-1"><AlertTriangle size={11} /> {error}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export function GlobalBidHistory() {
  const [requests, setRequests] = useState<BidRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiveModal, setReceiveModal] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedReceivedGroups, setExpandedReceivedGroups] = useState<Set<string>>(new Set());
  const selectedBidIds = useRequestStore((s) => s.selectedCompetitorBidIds);
  const toggleCompetitorBid = useRequestStore((s) => s.toggleCompetitorBid);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterWorkType, setFilterWorkType] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bid-request");
      const data = await res.json();
      setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleReceivedExpand(key: string) {
    setExpandedReceivedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function resetFilters() {
    setFilterWorkType(""); setFilterTitle(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterStatus("");
  }

  const bidGroups = useMemo<BidGroup[]>(() => {
    const groups: BidGroup[] = [];
    for (const req of requests) {
      const reqTime = req.sentAt ? new Date(req.sentAt).getTime() : 0;
      const match = groups.find((g) => {
        const gTime = g.sentAt ? new Date(g.sentAt).getTime() : 0;
        return g.title === req.title && g.workType?.id === req.workType?.id && Math.abs(gTime - reqTime) < 60_000;
      });
      if (match) { match.requests.push(req); }
      else {
        groups.push({
          key: `${req.title ?? ""}_${req.workType?.id ?? 0}_${req.sentAt ?? req.id}`,
          title: req.title, sentAt: req.sentAt, workType: req.workType,
          quotation: req.quotation, requests: [req],
        });
      }
    }
    return groups;
  }, [requests]);

  const filteredGroups = useMemo<BidGroup[]>(() => {
    return bidGroups.filter((group) => {
      if (filterWorkType.trim() && !group.workType?.name.toLowerCase().includes(filterWorkType.trim().toLowerCase())) return false;
      if (filterTitle.trim() && !group.title?.toLowerCase().includes(filterTitle.trim().toLowerCase())) return false;
      if (filterDateFrom) {
        const sent = group.sentAt ? new Date(group.sentAt) : null;
        if (!sent || sent < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo); to.setHours(23, 59, 59, 999);
        const sent = group.sentAt ? new Date(group.sentAt) : null;
        if (!sent || sent > to) return false;
      }
      if (filterStatus) {
        const allReceived = group.requests.every((r) => r.status === "received");
        const anyReceived = group.requests.some((r) => r.status === "received");
        if (filterStatus === "received" && !allReceived) return false;
        if (filterStatus === "partial" && !(anyReceived && !allReceived)) return false;
        if (filterStatus === "sent" && anyReceived) return false;
      }
      return true;
    });
  }, [bidGroups, filterWorkType, filterTitle, filterDateFrom, filterDateTo, filterStatus]);

  const activeFilterCount = [filterWorkType, filterTitle, filterDateFrom, filterDateTo, filterStatus].filter(Boolean).length;

  // 선택된 견적서 상세 정보 (최대 3개)
  const selectedBidDetails = useMemo(() => {
    if (selectedBidIds.length === 0) return [];
    const result: Array<{
      id: number;
      companyName: string;
      materialCost: number | null;
      laborCost: number | null;
      expenseCost: number | null;
      totalCost: number | null;
      workType: string | null;
    }> = [];
    for (const selId of selectedBidIds) {
      for (const req of requests) {
        const bid = req.receivedBids.find((b) => b.id === selId);
        if (bid) {
          const cost = bid.items[0] ?? null;
          result.push({
            id: bid.id,
            companyName: bid.companyName ?? bid.fileName,
            materialCost: cost?.materialCost ?? null,
            laborCost: cost?.laborCost ?? null,
            expenseCost: cost?.expenseCost ?? null,
            totalCost: cost?.totalCost ?? null,
            workType: req.workType?.name ?? null,
          });
          break;
        }
      }
    }
    return result;
  }, [requests, selectedBidIds]);

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Clock size={15} className="text-slate-400" />
          3사 견적 비교 단가 이력
          {!loading && filteredGroups.length !== bidGroups.length && (
            <span className="text-xs font-normal text-slate-400">({filteredGroups.length}/{bidGroups.length}건 표시)</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {!loading && bidGroups.length > 0 && (
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition ${filterOpen || activeFilterCount > 0 ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
            >
              <SlidersHorizontal size={12} />
              필터
              {activeFilterCount > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
          )}
          <Link href="/bid-request" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded transition">
            <Plus size={12} /> 새 견적 요청
          </Link>
        </div>
      </div>

      {/* 선택된 비교 견적 요약 카드 */}
      {selectedBidDetails.length > 0 && (
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 space-y-2">
          <div className="flex items-center gap-1.5">
            <Check size={13} className="text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-blue-800">
              비교 선택됨 ({selectedBidDetails.length}/3)
            </span>
            <span className="text-[10px] text-blue-400">— AI 분석 시 단가 합계 비교 카드에 반영됩니다</span>
          </div>
          {selectedBidDetails.map((detail, idx) => (
            <div key={detail.id} className="flex items-center justify-between gap-4 pl-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs font-semibold text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded-full">
                  {detail.companyName}
                </span>
                {detail.workType && (
                  <span className="text-xs text-blue-500">{detail.workType}</span>
                )}
                <div className="flex items-center gap-3 text-xs">
                  {detail.materialCost != null && (
                    <span className="text-slate-600">재료비 <span className="font-mono font-semibold text-slate-800">{fmtMoney(detail.materialCost)}</span></span>
                  )}
                  {detail.laborCost != null && (
                    <span className="text-slate-600">노무비 <span className="font-mono font-semibold text-slate-800">{fmtMoney(detail.laborCost)}</span></span>
                  )}
                  {detail.expenseCost != null && (
                    <span className="text-slate-600">경비 <span className="font-mono font-semibold text-slate-800">{fmtMoney(detail.expenseCost)}</span></span>
                  )}
                  {detail.totalCost != null && (
                    <span className="font-semibold text-blue-700">합계 <span className="font-mono">{fmtMoney(detail.totalCost)}</span></span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleCompetitorBid(detail.id)}
                className="text-blue-400 hover:text-blue-600 shrink-0 transition"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="px-5 py-6 text-xs text-slate-400 flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" /> 불러오는 중...
        </div>
      )}

      {!loading && bidGroups.length === 0 && (
        <div className="px-5 py-8 text-center space-y-3">
          <Send size={28} className="text-slate-200 mx-auto" />
          <p className="text-sm text-slate-400">발송된 3사 견적 요청이 없습니다.</p>
          <Link href="/bid-request" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded transition">
            <Send size={12} /> 3사 견적 요청하기
          </Link>
        </div>
      )}

      {!loading && bidGroups.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2.5 w-8 text-center" />
                <th className="text-left px-3 py-2.5 font-medium text-slate-600 text-xs w-28">공종</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-600 text-xs">제목</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-600 text-xs">수신처</th>
                <th className="text-center px-3 py-2.5 font-medium text-slate-600 text-xs w-28">발송일</th>
                <th className="text-center px-3 py-2.5 font-medium text-slate-600 text-xs w-28">상태</th>
                <th className="text-center px-3 py-2.5 font-medium text-slate-600 text-xs w-28">수령 / 비교</th>
              </tr>
              {filterOpen && (
                <tr className="border-t border-slate-200 bg-white">
                  <th className="px-3 py-2">
                    {activeFilterCount > 0 && (
                      <button onClick={resetFilters} title="필터 초기화" className="flex items-center justify-center w-full text-rose-400 hover:text-rose-600 transition">
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </th>
                  <th className="px-2 py-2">
                    <input value={filterWorkType} onChange={(e) => setFilterWorkType(e.target.value)} placeholder="공종 검색"
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </th>
                  <th className="px-2 py-2">
                    <input value={filterTitle} onChange={(e) => setFilterTitle(e.target.value)} placeholder="제목 검색"
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </th>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                        className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </th>
                  <th className="px-2 py-2">
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                      <option value="">전체</option>
                      <option value="sent">발송완료</option>
                      <option value="partial">일부수령</option>
                      <option value="received">수령완료</option>
                    </select>
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              )}
            </thead>
            <tbody>
              {filteredGroups.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-xs">조건에 맞는 이력이 없습니다.</td></tr>
              )}
              {filteredGroups.map((group) => {
                const isMulti = group.requests.length > 1;
                const isExpanded = expandedGroups.has(group.key);
                const isReceivedExpanded = expandedReceivedGroups.has(group.key);
                const first = group.requests[0];
                const totalReceived = group.requests.reduce((a, r) => a + r.receivedBids.length, 0);
                const allReceived = group.requests.every((r) => r.status === "received");
                const someReceived = group.requests.some((r) => r.status === "received");
                const allBids = group.requests.flatMap((r) => r.receivedBids);

                return (
                  <Fragment key={group.key}>
                    {/* 그룹 헤더 행 */}
                    <tr
                      className={`border-t border-slate-100 hover:bg-slate-50/60 transition ${isMulti ? "cursor-pointer select-none" : ""}`}
                      onClick={isMulti ? () => toggleGroup(group.key) : undefined}
                    >
                      <td className="px-3 py-2.5 text-center align-middle">
                        {isMulti && (
                          <ChevronDown size={13} className={`text-slate-400 transition-transform duration-150 mx-auto ${isExpanded ? "rotate-180" : ""}`} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle text-xs text-slate-600">{group.workType?.name ?? "-"}</td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="text-xs font-medium text-slate-800 truncate max-w-[200px]">{group.title ?? "견적 요청"}</div>
                        {group.quotation && (
                          <Link href={`/review/${group.quotation.id}`} onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-blue-500 hover:underline truncate max-w-[200px] block">
                            <FileText size={9} className="inline mr-0.5" />{group.quotation.fileName}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {isMulti ? (
                          <span className="flex items-center gap-1.5 text-xs text-slate-700">
                            {first.companyName ?? "-"}
                            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">외 {group.requests.length - 1}개사</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-700">{first.companyName ?? "-"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle text-center text-xs font-mono text-slate-500">{fmtDate(group.sentAt)}</td>
                      <td className="px-3 py-2.5 align-middle text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${allReceived ? "bg-emerald-100 text-emerald-700" : someReceived ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {allReceived ? "수령완료" : someReceived ? "일부수령" : "발송완료"}
                        </span>
                      </td>
                      {/* 수령/비교 셀 */}
                      <td className="px-3 py-2.5 align-middle text-center">
                        {totalReceived > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleReceivedExpand(group.key); }}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition ${isReceivedExpanded ? "bg-emerald-600 text-white border-emerald-600" : "text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100"}`}
                          >
                            {totalReceived}건 수령
                            <ChevronDown size={11} className={`transition-transform duration-150 ${isReceivedExpanded ? "rotate-180" : ""}`} />
                          </button>
                        ) : !isMulti ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setReceiveModal(first.id); }}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded transition"
                          >
                            <Upload size={11} /> 수령
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">대기 중</span>
                        )}
                      </td>
                    </tr>

                    {/* 수령 견적 비용 비교 행 (단일 그룹 확장) */}
                    {!isMulti && isReceivedExpanded && allBids.map((bid) => {
                      const cost = bid.items[0] ?? null;
                      const bidIdx = selectedBidIds.indexOf(bid.id);
                      const isSelected = bidIdx !== -1;
                      const canSelect = isSelected || selectedBidIds.length < 3;
                      return (
                        <tr key={`rBid-${bid.id}`} className="border-t border-slate-50 bg-emerald-50/30">
                          <td className="px-3 py-2.5 align-middle" />
                          <td className="px-3 py-2.5 align-middle">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              {bid.companyName ?? bid.fileName}
                            </span>
                          </td>
                          <td colSpan={3} className="px-3 py-2.5 align-middle">
                            {cost ? (
                              <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600">
                                {cost.materialCost != null && <span>재료비 <span className="font-mono font-semibold text-slate-800">{fmtMoney(cost.materialCost)}</span></span>}
                                {cost.laborCost != null && <span>노무비 <span className="font-mono font-semibold text-slate-800">{fmtMoney(cost.laborCost)}</span></span>}
                                {cost.expenseCost != null && <span>경비 <span className="font-mono font-semibold text-slate-800">{fmtMoney(cost.expenseCost)}</span></span>}
                                {cost.totalCost != null && <span className="font-bold text-slate-800">합계 <span className="font-mono text-blue-700">{fmtMoney(cost.totalCost)}</span></span>}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">단가 데이터 없음</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            <button
                              onClick={() => canSelect && toggleCompetitorBid(bid.id)}
                              disabled={!canSelect}
                              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded border transition ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : canSelect
                                  ? "border-blue-300 text-blue-600 hover:bg-blue-50"
                                  : "border-slate-200 text-slate-400 opacity-50 cursor-not-allowed"
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <span className="w-3.5 h-3.5 rounded-full bg-white/25 text-[9px] font-bold flex items-center justify-center">{bidIdx + 1}</span>
                                  선택됨
                                </>
                              ) : canSelect ? "비교 선택" : "3개 초과"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* 멀티 그룹 개별 업체 펼침 */}
                    {isMulti && isExpanded && group.requests.map((r) => {
                      const rBids = r.receivedBids;
                      return (
                        <tr key={`sub-${r.id}`} className="border-t border-slate-50 bg-slate-50/70">
                          <td className="px-3 py-2.5 align-middle" />
                          <td className="px-3 py-2.5 align-middle text-xs text-slate-400">{r.workType?.name ?? "-"}</td>
                          <td className="px-3 py-2.5 align-middle text-xs text-slate-400 truncate max-w-[200px]">{r.title ?? "-"}</td>
                          <td className="px-3 py-2.5 align-middle">
                            <span className="flex items-center gap-1.5 text-xs text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                              {r.companyName ?? "-"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center text-xs font-mono text-slate-400">{fmtDate(r.sentAt)}</td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "received" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                              {r.status === "received" ? "수령완료" : "발송완료"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            {rBids.length > 0 ? (
                              <div className="space-y-1">
                                {rBids.map((bid) => {
                                  const cost = bid.items[0] ?? null;
                                  const bidIdx = selectedBidIds.indexOf(bid.id);
                                  const isSelected = bidIdx !== -1;
                                  const canSelect = isSelected || selectedBidIds.length < 3;
                                  return (
                                    <div key={bid.id} className="flex flex-col items-center gap-1">
                                      {cost?.totalCost != null && (
                                        <span className="text-[11px] font-mono font-semibold text-blue-700">{fmtMoney(cost.totalCost)}</span>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); if (canSelect) toggleCompetitorBid(bid.id); }}
                                        disabled={!canSelect}
                                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border transition ${
                                          isSelected
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : canSelect
                                            ? "border-blue-300 text-blue-600 hover:bg-blue-50"
                                            : "border-slate-200 text-slate-400 opacity-50 cursor-not-allowed"
                                        }`}
                                      >
                                        {isSelected ? (
                                          <>
                                            <span className="w-3 h-3 rounded-full bg-white/25 text-[9px] font-bold flex items-center justify-center">{bidIdx + 1}</span>
                                            선택됨
                                          </>
                                        ) : canSelect ? "비교 선택" : "3개 초과"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setReceiveModal(r.id); }}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded transition"
                              >
                                <Upload size={11} /> 수령
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {receiveModal !== null && (
        <ReceiveModal bidRequestId={receiveModal} onDone={() => { load(); }} onClose={() => setReceiveModal(null)} />
      )}
    </section>
  );
}
