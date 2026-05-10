"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

interface Props {
  quotationId: number;
  autoStart?: boolean;
  initialCommentary?: string | null;
  initialCommentaryAt?: string | Date | null;
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function parseCommentary(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <div
          key={i}
          className="flex items-center gap-2 mt-5 mb-1.5"
          style={i === 0 ? { marginTop: 0 } : undefined}
        >
          <div className="w-1 h-4 bg-blue-400 rounded-full shrink-0" />
          <h3 className="text-sm font-bold text-slate-800">
            {trimmed.slice(3)}
          </h3>
        </div>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h2
          key={i}
          className="text-base font-bold text-slate-900 mt-4 mb-2"
          style={i === 0 ? { marginTop: 0 } : undefined}
        >
          {trimmed.slice(2)}
        </h2>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const content = trimmed.slice(2);
      const isNested = indent >= 2;
      if (isNested) {
        elements.push(
          <div key={i} className="pl-12 my-0.5">
            <p className="text-xs text-slate-600 leading-relaxed">
              {renderInline(content)}
            </p>
          </div>
        );
      } else {
        elements.push(
          <div key={i} className="flex items-start gap-2 pl-6 my-0.5">
            <span className="mt-[0.45rem] w-1 h-1 rounded-full bg-slate-300 shrink-0" />
            <p className="text-xs text-slate-600 leading-relaxed">
              {renderInline(content)}
            </p>
          </div>
        );
      }
    } else if (/^\d+\./.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (match) {
        const isNested = indent >= 2;
        if (isNested) {
          elements.push(
            <div key={i} className="pl-12 my-0.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="text-slate-400 mr-1.5 tabular-nums">
                  {match[1]}.
                </span>
                {renderInline(match[2])}
              </p>
            </div>
          );
        } else {
          elements.push(
            <div key={i} className="flex items-start gap-2 pl-6 my-0.5">
              <span className="text-[10px] font-bold text-slate-400 shrink-0 mt-0.5 w-4 tabular-nums">
                {match[1]}.
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {renderInline(match[2])}
              </p>
            </div>
          );
        }
      }
    } else {
      elements.push(
        <p key={i} className="text-sm text-slate-700 leading-relaxed">
          {renderInline(trimmed)}
        </p>
      );
    }
  });

  return <>{elements}</>;
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
    if (hasCached) return;
    void start();
    return () => {
      abortRef.current?.abort();
    };
  }, [autoStart, hasCached, start]);

  const fullText = chunks.join("");

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 상단 컬러 바 */}
      <div className="h-0.5 bg-gradient-to-r from-blue-400 via-violet-400 to-blue-300" />

      <div className="p-6 space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-violet-100 text-blue-600 ring-1 ring-blue-200/50">
              <Sparkles size={16} />
            </span>
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
            className="text-xs border border-slate-300 px-3 py-1 rounded inline-flex items-center gap-1 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={streaming ? "animate-spin" : ""} />
            {streaming ? "생성 중..." : "다시 생성"}
          </button>
        </div>

        {/* 본문 */}
        <div className="min-h-[80px]">
          {chunks.length === 0 && !streaming && !error && (
            <p className="text-slate-400 text-sm">
              아직 작성된 분석 코멘트가 없습니다. &quot;다시 생성&quot;을 눌러
              시작하세요.
            </p>
          )}

          {chunks.length > 0 && (
            <div className="space-y-1">{parseCommentary(fullText)}</div>
          )}

          {streaming && chunks.length === 0 && (
            <p className="text-slate-400 text-sm animate-pulse">
              AI가 분석 중입니다...
            </p>
          )}

          {streaming && (
            <span className="streaming-caret text-blue-500 inline-block" />
          )}
        </div>

        {error && (
          <div className="text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded p-2">
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}
