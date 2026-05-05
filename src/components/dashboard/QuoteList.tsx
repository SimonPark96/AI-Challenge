"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ChevronRight, RefreshCw, Trash2 } from "lucide-react";

type Filter = "all" | "inProgress" | "completed" | "failed";

interface QuoteSummary {
  id: number;
  fileName: string;
  uploadedAt: string;
  status: string;
  errorMsg: string | null;
  itemCount: number;
  projectName: string | null;
  partnerName: string | null;
  summary: {
    itemName: string;
    spec: string | null;
    unit: string | null;
    unitPrice: number | null;
    marketPrice: number | null;
    deviationPct: number | null;
    matchedConfidence: number | null;
  } | null;
}

const TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "inProgress", label: "진행 중" },
  { value: "completed", label: "완료" },
  { value: "failed", label: "실패" },
];

export function QuoteList() {
  const [filter, setFilter] = useState<Filter>("all");
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "50",
        status: filter,
      });
      const res = await fetch(`/api/quote?${params.toString()}`);
      const data = await res.json();
      setQuotes(data.quotes ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const onDelete = useCallback(async (q: QuoteSummary) => {
    const label = q.summary?.itemName
      ? `"${q.summary.itemName}"${q.itemCount > 1 ? ` 외 ${q.itemCount - 1}건` : ""}`
      : `#${q.id}`;
    if (
      !window.confirm(
        `${label} 견적을 삭제할까요?\n관련 라인 아이템과 매칭 결과가 모두 삭제됩니다.`
      )
    ) {
      return;
    }
    setDeletingId(q.id);
    try {
      const res = await fetch(`/api/quote/${q.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setQuotes((prev) => prev.filter((x) => x.id !== q.id));
    } catch (err) {
      window.alert(
        `삭제 실패: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <section className="bg-white rounded-lg border border-slate-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`px-3 py-1.5 rounded text-sm transition ${
                filter === t.value
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchList}
          disabled={loading}
          className="text-xs border border-slate-300 px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">#</th>
              <th className="text-left p-3 font-medium">프로젝트 / 협력사</th>
              <th className="text-left p-3 font-medium">품명</th>
              <th className="text-right p-3 font-medium">제시가</th>
              <th className="text-right p-3 font-medium">시장가</th>
              <th className="text-right p-3 font-medium">편차</th>
              <th className="text-right p-3 font-medium">신뢰도</th>
              <th className="text-left p-3 font-medium">상태</th>
              <th className="text-left p-3 font-medium">시각</th>
              <th className="p-3"></th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <Row
                key={q.id}
                q={q}
                deleting={deletingId === q.id}
                onDelete={() => onDelete(q)}
              />
            ))}
            {quotes.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={11}
                  className="p-12 text-center text-slate-400 text-sm"
                >
                  분석 항목이 없습니다.{" "}
                  <Link
                    href="/request"
                    className="text-blue-600 hover:underline"
                  >
                    단가 검토 요청하기 →
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({
  q,
  deleting,
  onDelete,
}: {
  q: QuoteSummary;
  deleting: boolean;
  onDelete: () => void;
}) {
  const dev = q.summary?.deviationPct;
  const conf = q.summary?.matchedConfidence;
  return (
    <tr
      className={`border-t border-slate-100 hover:bg-slate-50 ${
        deleting ? "opacity-50" : ""
      }`}
    >
      <td className="p-3 font-mono text-slate-500">{q.id}</td>
      <td className="p-3">
        <div className="text-slate-800">{q.projectName ?? "-"}</div>
        <div className="text-xs text-slate-400">{q.partnerName ?? "-"}</div>
      </td>
      <td className="p-3 text-slate-700 max-w-xs truncate">
        {q.summary?.itemName ?? "-"}
        {q.summary?.spec && (
          <span className="text-xs text-slate-400 ml-1">
            · {q.summary.spec}
          </span>
        )}
      </td>
      <td className="p-3 text-right font-mono">
        {q.summary?.unitPrice != null
          ? q.summary.unitPrice.toLocaleString()
          : "-"}
      </td>
      <td className="p-3 text-right font-mono">
        {q.summary?.marketPrice != null
          ? q.summary.marketPrice.toLocaleString()
          : "-"}
      </td>
      <td
        className={`p-3 text-right font-mono ${
          dev == null
            ? "text-slate-400"
            : dev > 10
              ? "text-rose-600"
              : dev < -10
                ? "text-blue-600"
                : "text-emerald-600"
        }`}
      >
        {dev != null ? `${dev > 0 ? "+" : ""}${dev.toFixed(1)}%` : "-"}
      </td>
      <td className="p-3 text-right text-xs">
        {conf != null ? `${(conf * 100).toFixed(0)}%` : "-"}
      </td>
      <td className="p-3">
        <StatusBadge status={q.status} />
      </td>
      <td className="p-3 text-xs text-slate-500">
        {new Date(q.uploadedAt).toLocaleString()}
      </td>
      <td className="p-3 text-right">
        <Link
          href={`/review/${q.id}`}
          className="text-blue-600 hover:underline inline-flex items-center text-sm"
        >
          열기 <ChevronRight size={14} />
        </Link>
      </td>
      <td className="p-3 text-right">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title="삭제"
          className="text-slate-400 hover:text-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; cls: string }
  > = {
    pending: {
      label: "대기",
      cls: "bg-slate-100 text-slate-600 border-slate-200",
    },
    parsing: {
      label: "파싱 중",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    },
    compared: {
      label: "완료",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    failed: {
      label: "실패",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
    },
  };
  const m = map[status] ?? {
    label: status,
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded border ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
