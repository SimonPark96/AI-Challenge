"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

type ResetType = "scrape" | "summary" | "wage" | "all";

const LABEL: Record<ResetType, string> = {
  scrape: "자재 단가 전체 삭제",
  summary: "일괄 단가 전체 삭제",
  wage: "노임 단가 전체 삭제",
  all: "자재 + 일괄 + 노임 전부 삭제",
};

const CONFIRM: Record<ResetType, string> = {
  scrape:
    "정말 자재 단가 데이터 (수집 회차 + 자재 단가 이력) 를 전체 삭제하시겠습니까?\n(일괄 단가 / 노임 단가 / 견적은 유지됩니다)",
  summary:
    "정말 일괄 단가 데이터를 전체 삭제하시겠습니까?\n(자재 / 노임 단가 / 견적은 유지됩니다)",
  wage:
    "정말 노임 단가 데이터 (수집 회차 + 노임 단가 이력) 를 전체 삭제하시겠습니까?\n(자재 / 일괄 / 견적은 유지됩니다)",
  all:
    "정말 자재 단가 + 일괄 단가 + 노임 단가 자료를 전부 삭제하시겠습니까?\n(자재 마스터 / 견적 본문은 유지됩니다)",
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
        자재 단가, 일괄 단가, 노임 단가를 도메인별로 분리해 비울 수 있습니다.
        견적의 매칭 정보는 자동으로 정리(SetNull)되며, 자재 마스터·견적 본문은 보존됩니다.
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
          onClick={() => reset("wage")}
          disabled={working !== null}
          className="border border-rose-300 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded text-xs disabled:opacity-50"
        >
          {working === "wage" ? "삭제 중..." : LABEL.wage}
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
