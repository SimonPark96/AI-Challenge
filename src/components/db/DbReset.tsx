"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

type ResetType = "scrape" | "summary" | "all";

const LABEL: Record<ResetType, string> = {
  scrape: "ScrapeRun + PriceHistory 전체 삭제 (스크래핑 자료)",
  summary: "PriceSummary 전체 삭제 (일괄 등록 자료)",
  all: "스크래핑 + 일괄 등록 자료 전부 삭제",
};

const CONFIRM: Record<ResetType, string> = {
  scrape:
    "정말 ScrapeRun + PriceHistory 전체 삭제하시겠습니까?\n(외부 사이트 스크래핑 자료. PriceSummary/Quotation 은 유지)",
  summary:
    "정말 PriceSummary 전체 삭제하시겠습니까?\n(외부 단가 자료 일괄 등록 결과. 스크래핑 자료/Quotation 은 유지)",
  all: "정말 스크래핑 + 일괄 등록 자료 전부 삭제하시겠습니까?\n(Material/Quotation 은 유지)",
};

export function DbReset() {
  const [working, setWorking] = useState<ResetType | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function reset(type: ResetType) {
    if (!confirm(CONFIRM[type])) return;
    setWorking(type);
    setResult(null);
    try {
      const res = await fetch(`/api/reset?type=${type}`, { method: "POST" });
      const data = await res.json();
      setResult({ status: res.status, ...data });
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setWorking(null);
    }
  }

  return (
    <section className="bg-rose-50/30 rounded-lg border border-rose-200 p-6 space-y-3">
      <h2 className="text-base font-semibold text-rose-800 flex items-center gap-2">
        <AlertTriangle size={18} /> 위험 영역 — DB 리셋
      </h2>
      <p className="text-xs text-rose-700/80">
        스크래핑 자료(ScrapeRun + PriceHistory) 와 일괄 등록 자료(PriceSummary)
        를 분리해서 비울 수 있습니다. Quotation 의 매칭 ID 는 onDelete: SetNull
        로 자동 정리됩니다. Material/Quotation 본문은 보존.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => reset("scrape")}
          disabled={working !== null}
          className="border border-rose-300 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded text-xs disabled:opacity-50"
        >
          {working === "scrape" ? "삭제 중..." : LABEL.scrape}
        </button>
        <button
          onClick={() => reset("summary")}
          disabled={working !== null}
          className="border border-rose-300 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded text-xs disabled:opacity-50"
        >
          {working === "summary" ? "삭제 중..." : LABEL.summary}
        </button>
        <button
          onClick={() => reset("all")}
          disabled={working !== null}
          className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded text-xs disabled:opacity-50"
        >
          {working === "all" ? "삭제 중..." : LABEL.all}
        </button>
      </div>
      {result !== null && (
        <pre className="bg-white border border-rose-200 p-3 rounded text-xs overflow-auto max-h-48">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
  );
}
