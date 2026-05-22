"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, BarChart2, FileText } from "lucide-react";
import { useRequestStore, type DataTab } from "@/lib/stores/request-store";

const TABS: {
  key: DataTab;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "db", label: "DB단가 견적", href: "/price-review/db", icon: Database },
  { key: "actual", label: "실적단가 견적", href: "/price-review/actual", icon: BarChart2 },
  { key: "bid", label: "비교 견적", href: "/price-review/bid", icon: FileText },
];

interface Props {
  /**
   * "inline" — request 페이지 내부 탭. store 상태로 콘텐츠 전환.
   * "header" — StepIndicator 아래 탭. URL 기반 이동, 사이드바와 연동.
   */
  variant?: "inline" | "header";
}

export function DataTabsBar({ variant = "inline" }: Props) {
  const pathname = usePathname();
  const activeTab = useRequestStore((s) => s.activeDataTab);
  const setTab = useRequestStore((s) => s.setActiveDataTab);

  return (
    <div className="flex border-b border-slate-200 bg-white">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          variant === "header"
            ? pathname === tab.href
            : activeTab === tab.key;

        if (variant === "header") {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </Link>
          );
        }

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              isActive
                ? "border-blue-600 text-blue-700 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
