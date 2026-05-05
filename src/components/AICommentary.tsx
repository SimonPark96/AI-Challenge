"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

interface Props {
  quotationId: number;
  autoStart?: boolean;
  initialCommentary?: string | null;
  initialCommentaryAt?: string | Date | null;
}

export function AICommentary({
  quotationId,
  autoStart = true,
  initialCommentary = null,
  initialCommentaryAt = null,
}: Props) {
  const hasCached = !!(initialCommentary && initialCommentary.trim() !== "");
  const [chunks, setChunks] = useState<string[]>(
    hasCached ? [initialCommentary as string] : []
  );
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(
    initialCommentaryAt ? new Date(initialCommentaryAt) : null
  );
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const myId = ++reqIdRef.current;

    setChunks([]);
    setError(null);
    setStreaming(true);

    try {
      const res = await fetch(`/api/quote/${quotationId}/commentary`, {
        method: "POST",
        signal: ac.signal,
      });
      if (myId !== reqIdRef.current) return;
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (myId !== reqIdRef.current) break;
        const text = decoder.decode(value, { stream: true });
        if (text) setChunks((prev) => [...prev, text]);
      }
      if (myId === reqIdRef.current) setGeneratedAt(new Date());
    } catch (err) {
      if (
        myId === reqIdRef.current &&
        (err as Error).name !== "AbortError"
      ) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (myId === reqIdRef.current) setStreaming(false);
    }
  }, [quotationId]);

  useEffect(() => {
    if (!autoStart) return;
    if (hasCached) return; // 이미 저장된 코멘트가 있으면 자동 생성 생략
    void start();
    return () => {
      abortRef.current?.abort();
    };
  }, [autoStart, hasCached, start]);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Sparkles className="text-blue-500" size={18} />
          AI 분석 코멘트
          {generatedAt && !streaming && (
            <span className="text-[11px] font-normal text-slate-400 ml-1">
              생성: {generatedAt.toLocaleString()}
            </span>
          )}
        </h2>
        <button
          onClick={start}
          disabled={streaming}
          className="text-xs border border-slate-300 px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={12}
            className={streaming ? "animate-spin" : ""}
          />
          {streaming ? "생성 중" : "다시 생성"}
        </button>
      </div>

      <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed min-h-[80px]">
        {chunks.length === 0 && !streaming && !error && (
          <span className="text-slate-400 text-sm">
            아직 작성된 분석 코멘트가 없습니다. &quot;다시 생성&quot; 을 눌러
            시작하세요.
          </span>
        )}
        {chunks.map((c, i) => (
          <span key={i} className="fade-in-chunk whitespace-pre-wrap">
            {c}
          </span>
        ))}
        {streaming && <span className="streaming-caret text-blue-500" />}
      </div>

      {error && (
        <div className="text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded p-2">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
