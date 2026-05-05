"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 제목 옆에 작은 [i] 아이콘을 두고, 마우스 호버 시 본문이 말풍선으로 뜨는 툴팁.
 * Tailwind group-hover 만으로 동작 — 별도 state 불필요.
 *
 * 사용 예: <InfoTooltip>긴 설명 텍스트</InfoTooltip>
 */
export function InfoTooltip({
  children,
  size = 14,
  width = "w-80",
  align = "center",
}: {
  children: ReactNode;
  size?: number;
  width?: string;
  align?: "left" | "center" | "right";
}) {
  const alignCls =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span className="relative inline-flex items-center group align-middle">
      <Info
        size={size}
        className="text-slate-400 hover:text-slate-600 cursor-help transition"
      />
      <span
        role="tooltip"
        className={`invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full mt-2 ${alignCls} ${width} p-3 bg-slate-900 text-slate-100 text-xs rounded-lg shadow-xl z-30 leading-relaxed transition-opacity pointer-events-none whitespace-normal text-left font-normal`}
      >
        {children}
      </span>
    </span>
  );
}
