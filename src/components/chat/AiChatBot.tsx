"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, RotateCcw, Send, X } from "lucide-react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

type Tab = "analysis" | "search";

interface AiChatBotProps {
  /**
   * "review": 분석 / 검색 두 탭 노출. quotationId 필수.
   * "search": 단가 검색 단일 탭만 노출. quotationId 불필요.
   */
  mode: "review" | "search";
  quotationId?: number;
}

const ANALYSIS_SAMPLES = [
  "이 견적에서 시장 대비 가장 비싼 항목 3개 알려줘",
  "매칭 신뢰도가 낮은 라인은?",
  "노임으로 매칭된 항목들의 출처가 어디야?",
];

const SEARCH_SAMPLES = [
  "이형철근 단가 알려줘",
  "보통인부 일당 얼마야?",
  "AL 시트패널 단가 검색해줘",
];

const TAB_LABELS: Record<Tab, string> = {
  analysis: "분석 AI 도우미",
  search: "단가 검색 AI 도우미",
};

const TAB_SUBTITLES: Record<Tab, string> = {
  analysis: "이 견적의 매칭 결과 Q&A",
  search: "DB 의 자재·노임·일괄 단가 검색",
};

export function AiChatBot({ mode, quotationId }: AiChatBotProps) {
  const [open, setOpen] = useState(false);
  // search 모드면 search 탭만, review 모드는 기본 analysis
  const [activeTab, setActiveTab] = useState<Tab>(
    mode === "review" ? "analysis" : "search"
  );
  // 탭별 메시지 분리
  const [analysisMessages, setAnalysisMessages] = useState<ChatMsg[]>([]);
  const [searchMessages, setSearchMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = activeTab === "analysis" ? analysisMessages : searchMessages;
  const setMessages =
    activeTab === "analysis" ? setAnalysisMessages : setSearchMessages;
  const samples = activeTab === "analysis" ? ANALYSIS_SAMPLES : SEARCH_SAMPLES;

  // 메시지 추가 시 자동 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [analysisMessages, searchMessages, streaming, activeTab]);

  // 패널 열릴 때 / 탭 변경 시 input 포커스
  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open, activeTab]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      // 분석 모드에서 quotationId 가 없으면 분석 탭은 사용 불가
      if (activeTab === "analysis" && !quotationId) {
        setError("견적이 지정되지 않아 분석 탭을 사용할 수 없습니다.");
        return;
      }

      const currentMessages =
        activeTab === "analysis" ? analysisMessages : searchMessages;
      const nextMessages: ChatMsg[] = [
        ...currentMessages,
        { role: "user", content: trimmed },
      ];
      const setter =
        activeTab === "analysis" ? setAnalysisMessages : setSearchMessages;
      setter([...nextMessages, { role: "assistant", content: "" }]);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setError(null);
      setStreaming(true);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const myId = ++reqIdRef.current;
      const myTab = activeTab;

      const url =
        myTab === "analysis"
          ? `/api/quote/${quotationId}/chat`
          : `/api/chat/price-search`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages }),
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
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          const targetSetter =
            myTab === "analysis" ? setAnalysisMessages : setSearchMessages;
          targetSetter((prev) => {
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = {
                role: "assistant",
                content: last.content + chunk,
              };
            }
            return copy;
          });
        }
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
    },
    [activeTab, analysisMessages, searchMessages, quotationId, streaming]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function reset() {
    abortRef.current?.abort();
    reqIdRef.current++;
    if (activeTab === "analysis") setAnalysisMessages([]);
    else setSearchMessages([]);
    setInput("");
    setError(null);
    setStreaming(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function switchTab(t: Tab) {
    if (t === activeTab || streaming) return;
    setActiveTab(t);
    setError(null);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  // ───────────── FAB ─────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="AI 도우미"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        <Bot size={24} />
      </button>
    );
  }

  // ───────────── Panel ─────────────
  return (
    <div
      className="fixed bottom-6 right-6 z-40 w-[400px] max-w-[calc(100vw-2rem)] h-[640px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
      role="dialog"
      aria-label="AI 도우미"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/25">
            <Bot size={18} />
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-indigo-600"
            aria-hidden
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">AI 도우미</div>
          <div className="text-[11px] text-white/80 truncate">
            {TAB_SUBTITLES[activeTab]}
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={messages.length === 0 && !streaming}
          title="현재 탭 대화 초기화"
          className="p-1.5 hover:bg-white/15 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="닫기"
          className="p-1.5 hover:bg-white/15 rounded-lg transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tab bar — review 모드에서만 노출 */}
      {mode === "review" && (
        <div className="flex border-b border-slate-200 bg-white">
          {(["analysis", "search"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              disabled={streaming}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition border-b-2 -mb-px ${
                activeTab === t
                  ? "border-blue-500 text-blue-700 bg-blue-50/60"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              } disabled:cursor-not-allowed`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50"
      >
        {messages.length === 0 && (
          <div className="space-y-3 pt-3">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Bot size={22} />
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {activeTab === "analysis"
                  ? "어떤 점이 궁금하신가요?"
                  : "어떤 단가를 찾으세요?"}
              </div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                {activeTab === "analysis"
                  ? "이 견적의 매칭 결과·합계 비교 데이터에"
                  : "DB 의 자재·노임·일괄 단가에서 검색해 드려요"}
                <br />
                자유롭게 물어보세요
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              {samples.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void send(p)}
                  className="group w-full text-left text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50/40 hover:shadow-sm transition"
                >
                  <span className="text-blue-500 mr-1.5 group-hover:translate-x-0.5 inline-block transition">
                    →
                  </span>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isLast = i === messages.length - 1;
          const isStreaming = streaming && isLast && m.role === "assistant";
          return (
            <div
              key={i}
              className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                  <Bot size={13} />
                </div>
              )}
              <div
                className={`max-w-[78%] min-w-0 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                  isUser
                    ? "bg-blue-600 text-white rounded-2xl rounded-br-md"
                    : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-bl-md shadow-sm"
                }`}
              >
                {m.content}
                {isStreaming && (
                  <span className="streaming-caret text-blue-500 ml-0.5" />
                )}
                {isStreaming && !m.content && (
                  <span className="text-slate-400 italic">생각 중…</span>
                )}
              </div>
            </div>
          );
        })}

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 bg-white border-t border-slate-100">
        <div className="flex items-end gap-2 bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              streaming ? "답변 생성 중…" : "질문을 입력하세요"
            }
            disabled={streaming}
            rows={1}
            className="flex-1 min-w-0 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed py-2 leading-snug min-h-9 max-h-32"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={streaming || input.trim() === ""}
            title="보내기 (Enter)"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl w-9 h-9 inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition shadow-sm"
          >
            <Send size={15} />
          </button>
        </div>
        <div className="mt-1.5 px-1 text-[10px] text-slate-400 leading-tight">
          Enter 전송 · Shift+Enter 줄바꿈 ·{" "}
          {activeTab === "analysis"
            ? "답변은 이 견적 데이터 기반"
            : "답변은 DB 검색 결과 기반"}
        </div>
      </div>
    </div>
  );
}
