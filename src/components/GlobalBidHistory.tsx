"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Send, Clock, FileText, Plus, Upload,
  Loader2, AlertTriangle, CheckCircle2, X,
} from "lucide-react";

interface ReceivedBid {
  id: number;
  companyName: string | null;
  fileName: string;
  status: string;
  createdAt: string;
}

interface BidRequest {
  id: number;
  title: string | null;
  status: string;
  sentAt: string | null;
  workType: { id: number; name: string } | null;
  quotation: { id: number; fileName: string } | null;
  receivedBids: ReceivedBid[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <p className="text-sm text-slate-700 font-medium">업로드 완료</p>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              확인
            </button>
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
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {uploading ? (
                <span className="text-xs text-blue-600 inline-flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" /> 분석 중...
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  <Upload size={12} className="inline mr-1" />XLSX · XLS · CSV 업로드
                </span>
              )}
            </div>
            {error && (
              <div className="text-xs text-rose-600 flex items-center gap-1">
                <AlertTriangle size={11} /> {error}
              </div>
            )}
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

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Clock size={15} className="text-slate-400" />
          3사 견적 비교 단가 이력
        </h2>
        <Link
          href="/bid-request"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded transition"
        >
          <Plus size={12} /> 새 견적 요청
        </Link>
      </div>

      {loading && (
        <div className="px-5 py-6 text-xs text-slate-400 flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" /> 불러오는 중...
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="px-5 py-8 text-center space-y-3">
          <Send size={28} className="text-slate-200 mx-auto" />
          <p className="text-sm text-slate-400">발송된 3사 견적 요청이 없습니다.</p>
          <Link
            href="/bid-request"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded transition"
          >
            <Send size={12} /> 3사 견적 요청하기
          </Link>
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div className="divide-y divide-slate-100">
          {requests.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition">
              <FileText size={14} className="text-blue-400 shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {r.title ?? "견적 요청"}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>{fmtDate(r.sentAt)}</span>
                  {r.quotation && (
                    <Link
                      href={`/review/${r.quotation.id}`}
                      className="text-blue-500 hover:underline truncate max-w-[160px]"
                    >
                      {r.quotation.fileName}
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {r.receivedBids.length > 0 ? (
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                    {r.receivedBids.length}건 수령
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    대기 중
                  </span>
                )}

                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.status === "received"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                }`}>
                  {r.status === "received" ? "수령완료" : "발송완료"}
                </span>

                <button
                  onClick={() => setReceiveModal(r.id)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded transition"
                >
                  <Upload size={11} /> 수령
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {receiveModal !== null && (
        <ReceiveModal
          bidRequestId={receiveModal}
          onDone={() => { load(); }}
          onClose={() => setReceiveModal(null)}
        />
      )}
    </section>
  );
}
