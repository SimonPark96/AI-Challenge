"use client";

import { useRequestStore, type AnalyzeTab } from "@/lib/stores/request-store";

const TABS: { key: AnalyzeTab; label: string }[] = [
  { key: "db", label: "사내 DB 단가" },
  { key: "actual", label: "사내 실적 단가" },
  { key: "bid", label: "비교 견적" },
  { key: "ai-matching", label: "일위대가 검토" },
  { key: "summary", label: "종합" },
];

export function AnalyzeBrowserTabs() {
  const active = useRequestStore((s) => s.activeAnalyzeTab);
  const setTab = useRequestStore((s) => s.setActiveAnalyzeTab);

  return (
    <div className="flex items-end gap-1 border-b border-slate-300 bg-slate-100 px-4 pt-2">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-t transition-colors select-none -mb-px ${
              isActive
                ? "bg-white border border-slate-300 border-b-white text-blue-700 font-semibold shadow-sm"
                : "bg-slate-200/70 border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
