"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";

export function ConfirmAction({
  quotationId,
  status,
}: {
  quotationId: number;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "unconfirm" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = status === "confirmed";

  async function confirm() {
    setBusy("confirm");
    setError(null);
    try {
      const r = await fetch(`/api/quote/${quotationId}/confirm`, {
        method: "POST",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function unconfirm() {
    setBusy("unconfirm");
    setError(null);
    try {
      const r = await fetch(`/api/quote/${quotationId}/confirm`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {isConfirmed ? (
        <button
          type="button"
          onClick={unconfirm}
          disabled={busy !== null}
          className="text-left w-full border border-emerald-300 bg-emerald-50/50 rounded p-4 hover:bg-emerald-50 transition disabled:opacity-50"
        >
          <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 size={16} />
            확정 완료
          </div>
          <div className="text-xs text-emerald-700/80 mt-1.5 leading-relaxed">
            현재 상태: <span className="font-mono">confirmed</span>. 검토 요청 목록의 “완료” 탭에서 보입니다.
          </div>
          <div className="text-xs text-slate-500 mt-2 inline-flex items-center gap-1">
            <RotateCcw size={11} />
            {busy === "unconfirm" ? "취소 중..." : "확정 취소 (다시 검토 중으로)"}
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={confirm}
          disabled={busy !== null}
          className="text-left w-full border border-blue-300 bg-blue-50/40 rounded p-4 hover:bg-blue-50 transition disabled:opacity-50"
        >
          <div className="flex items-center gap-2 text-blue-800 text-sm font-semibold">
            <CheckCircle2 size={16} />
            검토 결과 확정
          </div>
          <div className="text-xs text-blue-700/80 mt-1.5 leading-relaxed">
            확정 전까지는 검토 요청 목록의 “진행 중” 탭에 표시됩니다. 확정하면 “완료” 탭으로 이동합니다.
          </div>
          <div className="text-xs text-slate-500 mt-2">
            현재 상태: <span className="font-mono">{status}</span>
            {busy === "confirm" && " — 확정 중..."}
          </div>
        </button>
      )}
      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
          {error}
        </div>
      )}
    </div>
  );
}
