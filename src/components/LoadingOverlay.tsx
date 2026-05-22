"use client";

import { Bot } from "lucide-react";

interface Props {
  show: boolean;
  /** 큰 한 줄 — 현재 단계 */
  title: string;
  /** 작은 보조 설명 (선택) */
  description?: string;
}

/**
 * 화면 전체 딤드 + 중앙 아이콘(위) / 텍스트(아래) 세로 배치.
 * 길게 걸리는 비동기 작업(파일 추출, AI 분석) 동안 입력 차단용.
 */
export function LoadingOverlay({ show, title, description }: Props) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3 text-white text-center">
        <div className="relative">
          <Bot size={48} className="animate-bounce drop-shadow-md" strokeWidth={1.6} />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1.5 rounded-full bg-white/30 blur-[2px]" />
        </div>
        <div className="space-y-1">
          <div className="text-base font-semibold drop-shadow-sm">{title}</div>
          {description && (
            <div className="text-xs text-white/80 leading-relaxed max-w-xs">
              {description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
