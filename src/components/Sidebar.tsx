"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutGrid,
  FileSearch,
  Database,
  Send,
  ChevronDown,
  Database as DbIcon,
  BarChart2,
  FileText,
  Sparkles,
  ClipboardList,
} from "lucide-react";

const DATA_SUB_ITEMS: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** 정확 일치만 active 로 처리 (기본은 prefix 까지 active) */
  exact?: boolean;
}[] = [
  { href: "/request", label: "종합 검토", icon: ClipboardList, exact: true },
  { href: "/price-review/db", label: "DB단가 견적", icon: DbIcon },
  { href: "/price-review/actual", label: "실적단가 견적", icon: BarChart2 },
  { href: "/bid-request", label: "비교 견적 요청", icon: Send },
];

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const MENU: MenuItem[] = [
  { href: "/dashboard", label: "단가 검토 히스토리", icon: LayoutGrid },
  { href: "/db", label: "DB 관리", icon: Database },
];

const CURRENT_USER = {
  name: "박현우",
  role: "포스코현장 건축팀",
  initials: "박",
};

export function Sidebar() {
  const pathname = usePathname();
  const [reviewExpanded, setReviewExpanded] = useState(true);

  const reviewActive =
    pathname === "/request" ||
    pathname.startsWith("/request/") ||
    pathname.startsWith("/analyze/") ||
    pathname.startsWith("/review/") ||
    pathname.startsWith("/confirm/") ||
    pathname.startsWith("/price-review/") ||
    pathname === "/bid-request" ||
    pathname.startsWith("/bid-request/");

  return (
    <aside className="w-72 shrink-0 bg-[#001E62] text-slate-100 flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <Image
          src="/posco-enc-logo.png"
          alt="포스코이앤씨"
          width={3993}
          height={1583}
          priority
          className="h-9 w-auto brightness-0 invert opacity-95"
        />
        <div className="flex items-center gap-2 mt-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-sky-400/30 to-blue-500/30 ring-1 ring-white/25 text-sky-200 shrink-0">
            <Sparkles size={14} />
          </span>
          <div className="text-sm font-semibold text-white leading-tight truncate">
            AI 자동 단가 검토 서비스
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {/* 단가 검토 요청 (확장형) */}
        <div>
          <Link
            href="/request"
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
              reviewActive
                ? "bg-white text-[#001E62] font-semibold shadow-sm"
                : "text-slate-200 hover:bg-white/10 hover:text-white"
            }`}
          >
            <FileSearch size={16} />
            <span className="flex-1">단가 검토 요청</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setReviewExpanded((v) => !v);
              }}
              aria-label={reviewExpanded ? "하위 메뉴 접기" : "하위 메뉴 펼치기"}
              aria-expanded={reviewExpanded}
              className="-mr-1 p-1 rounded hover:bg-black/10"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  reviewExpanded ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>
          </Link>

          {reviewExpanded && (
            <div className="mt-0.5 ml-4 pl-4 border-l border-white/20 space-y-0.5">
              {DATA_SUB_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors ${
                      isActive
                        ? "bg-blue-500/30 text-white font-semibold"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={13} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 단가 검토 히스토리 */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
            pathname === "/dashboard"
              ? "bg-white text-[#001E62] font-semibold shadow-sm"
              : "text-slate-200 hover:bg-white/10 hover:text-white"
          }`}
        >
          <LayoutGrid size={16} />
          <span>단가 검토 히스토리</span>
        </Link>

        {/* DB 관리 등 */}
        {MENU.filter((m) => m.href !== "/dashboard").map((m) => {
          const active =
            pathname === m.href || pathname.startsWith(m.href + "/");
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                active
                  ? "bg-white text-[#001E62] font-semibold shadow-sm"
                  : "text-slate-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={16} />
              <span>{m.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-sm font-bold text-white shadow-sm ring-2 ring-white/20">
              {CURRENT_USER.initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#001E62]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">
              {CURRENT_USER.name}
            </div>
            <div className="text-[11px] text-slate-300 truncate">
              {CURRENT_USER.role}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-white/10 text-[11px] text-slate-400">
        AI 자동 단가 검토 v1.0
      </div>
    </aside>
  );
}
