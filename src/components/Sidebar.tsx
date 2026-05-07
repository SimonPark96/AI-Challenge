"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, FileSearch, Database, Send } from "lucide-react";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const MENU: MenuItem[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutGrid },
  { href: "/request", label: "단가 검토 요청", icon: FileSearch },
  { href: "/bid-request", label: "3사 견적 요청", icon: Send },
  { href: "/db", label: "DB 관리", icon: Database },
];

const CURRENT_USER = {
  name: "박현우",
  role: "포스코현장 건축팀",
  initials: "박",
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 bg-[#001E62] text-slate-100 flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <Image
          src="/posco-enc-logo.png"
          alt="포스코이앤씨"
          width={3993}
          height={1583}
          priority
          className="h-7 w-auto brightness-0 invert opacity-95"
        />
        <div className="text-base font-semibold text-white mt-2 leading-tight truncate">
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
