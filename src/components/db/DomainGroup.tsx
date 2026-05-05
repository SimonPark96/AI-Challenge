"use client";

import { useState, type ReactNode } from "react";

interface Tab {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * 도메인 단위로 묶인 영역. 제목 + 설명 + 탭(수집/조회) 으로 구성.
 * 탭 전환 시 active 패널만 mount → 그 안의 컴포넌트가 자체 fetch 로 fresh 데이터를 가져옴.
 */
export function DomainGroup({
  title,
  description,
  icon,
  tabs,
  defaultTab,
  accent = "slate",
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  tabs: Tab[];
  defaultTab?: string;
  accent?: "slate" | "blue" | "emerald" | "amber";
}) {
  const [active, setActive] = useState<string>(defaultTab ?? tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  const accentBar = {
    slate: "bg-slate-300",
    blue: "bg-blue-400",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
  }[accent];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-1 h-6 rounded ${accentBar}`} aria-hidden />
          {icon ? <span className="text-slate-600">{icon}</span> : null}
          <h2 className="text-lg font-bold text-slate-800 truncate">{title}</h2>
          {description && (
            <span className="text-xs text-slate-500 truncate">— {description}</span>
          )}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`px-3 py-1 rounded text-sm transition ${
                active === t.key
                  ? "bg-white text-slate-900 shadow-sm font-medium"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">{current?.content}</div>
    </section>
  );
}
