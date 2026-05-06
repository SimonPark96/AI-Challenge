"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";

interface Props {
  quotationId: number;
  status: string;
}

/**
 * 작업지시서 페이지 상단의 [결재요청] 버튼.
 * 클릭 시 quotation status -> confirmed 로 변경 후 대시보드로 이동.
 * 이미 confirmed 인 경우 "결재요청 완료" 배지로 표시.
 */
export function ApprovalRequestButton({ quotationId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = status === "confirmed";

  async function request() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/quote/${quotationId}/confirm`, {
        method: "POST",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      router.push("/dashboard?tab=completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (isConfirmed) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-100 text-emerald-700 text-sm font-medium border border-emerald-200">
        <CheckCircle2 size={16} />
        결재요청 완료
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={request}
        disabled={busy}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50 shadow-sm"
      >
        <Send size={14} />
        {busy ? "요청 중..." : "결재요청"}
      </button>
      {error && (
        <span className="text-[11px] text-rose-600 max-w-xs text-right">
          {error}
        </span>
      )}
    </div>
  );
}
