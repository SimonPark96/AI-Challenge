"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, FileSearch, Database } from "lucide-react";
import { useEffect, useState } from "react";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const MENU: MenuItem[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutGrid },
  { href: "/request", label: "단가 검토 요청", icon: FileSearch },
  { href: "/db", label: "DB 관리", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();
  const [stats, setStats] = useState<{
    internal: number;
    external: number;
    summaries: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/sidebar-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setStats(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="w-60 shrink-0 bg-slate-800 text-slate-100 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-700/60">
        <div className="text-xs text-slate-400 leading-tight">POSCO E&C</div>
        <div className="text-base font-semibold text-white mt-0.5">
          AI 자동 단가 검토
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {MENU.map((m) => {
          const active =
            pathname === m.href || pathname.startsWith(m.href + "/");
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
              }`}
            >
              <Icon size={16} />
              <span>{m.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-slate-700/60 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-400 mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-300">DB 현황</span>
        </div>
        <div className="space-y-1 pl-3 text-slate-400">
          <div className="flex justify-between">
            <span>내부 실적</span>
            <span>{stats?.internal ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span>외부 물가 (자재)</span>
            <span>{stats?.external ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span>외부 단가 (합계)</span>
            <span>{stats?.summaries ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-slate-700/60 text-[11px] text-slate-500">
        AI 자동 단가 검토 v1.0
      </div>
    </aside>
  );
}
