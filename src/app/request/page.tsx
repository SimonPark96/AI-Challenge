"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RotateCcw, ChevronRight, ChevronLeft, BarChart2 } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { QuoteUpload } from "@/components/QuoteUpload";
import { RequestFormSection } from "@/components/RequestForm";
import { PriceSummarySelector } from "@/components/PriceSummarySelector";
import { ConfidentialMatchCard } from "@/components/ConfidentialMatchCard";
import { AiChatBot } from "@/components/chat/AiChatBot";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useRequestStore } from "@/lib/stores/request-store";
import { GlobalBidHistory } from "@/components/GlobalBidHistory";

type PageStep = 1 | 2;

export default function RequestPage() {
  const router = useRouter();
  const submit = useRequestStore((s) => s.submit);
  const submitting = useRequestStore((s) => s.submitting);
  const submitError = useRequestStore((s) => s.submitError);
  const status = useRequestStore((s) => s.status);
  const resetForm = useRequestStore((s) => s.resetForm);
  const [navigating, setNavigating] = useState(false);
  const [pageStep, setPageStep] = useState<PageStep>(1);

  async function onSubmit() {
    const r = await submit();
    if (r) {
      setNavigating(true);
      router.push(`/review/${r.quotationId}`);
    }
  }

  const isExtracting = status === "parsing";
  const isAnalyzing = submitting || navigating;

  function onReset() {
    if (
      window.confirm(
        "입력한 모든 내용(파일·요청 정보·품목·단가·매칭 선택)이 초기화됩니다. 진행할까요?"
      )
    ) {
      resetForm();
      setPageStep(1);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">
          01. 단가 검토 요청
        </h1>
        <button
          type="button"
          onClick={onReset}
          disabled={submitting || status === "parsing"}
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-600 border border-slate-300 hover:border-rose-300 hover:bg-rose-50 px-3 py-1.5 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="모든 입력 내용 초기화"
        >
          <RotateCcw size={12} />
          전체 리셋
        </button>
      </header>

      <StepIndicator activeStep={1} />

      {/* 페이지 내부 서브스텝 인디케이터 */}
      <div className="bg-white rounded-lg border border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          {/* 서브스텝 1 */}
          <button
            onClick={() => setPageStep(1)}
            className="flex items-center gap-2.5 flex-1 group"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                pageStep === 1
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-blue-600"
              }`}
            >
              1
            </div>
            <div className="text-left min-w-0">
              <div
                className={`text-sm font-medium transition-colors ${
                  pageStep === 1 ? "text-blue-700" : "text-slate-500"
                }`}
              >
                견적 정보 입력
              </div>
              <div className="text-[11px] text-slate-400">파일 업로드 · 내역 작성</div>
            </div>
          </button>

          <ChevronRight size={16} className="text-slate-300 shrink-0 mx-1" />

          {/* 서브스텝 2 */}
          <button
            onClick={() => setPageStep(2)}
            className="flex items-center gap-2.5 flex-1 group"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                pageStep === 2
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              2
            </div>
            <div className="text-left min-w-0">
              <div
                className={`text-sm font-medium transition-colors ${
                  pageStep === 2 ? "text-blue-700" : "text-slate-400"
                }`}
              >
                사내/외 데이터 비교
              </div>
              <div className="text-[11px] text-slate-400">DB · 실적 · 3사 견적 매칭</div>
            </div>
          </button>
        </div>

        {/* 진행 바 */}
        <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: pageStep === 1 ? "50%" : "100%" }}
          />
        </div>
      </div>

      {/* ── 서브스텝 1: 견적 정보 입력 ── */}
      {pageStep === 1 && (
        <>
          <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <span>📄</span> 협력사 견적서 / 일위대가 업로드
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  파일을 올리면 AI 가 헤더 정보·라인 아이템·재료비/노무비/경비 합계를
                  자동 추출하여 아래 양식에 채웁니다.
                </p>
              </div>
              <button
                disabled
                className="text-xs text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded inline-flex items-center gap-1"
              >
                <Sparkles size={12} />
                업로드 즉시 AI 자동 인식
              </button>
            </div>
            <QuoteUpload />
          </section>

          <RequestFormSection />

          {submitError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3">
              {submitError}
            </div>
          )}

          <div className="flex justify-end pb-4">
            <button
              onClick={() => setPageStep(2)}
              disabled={status === "parsing"}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <BarChart2 size={16} />
              사내,외 데이터 비교
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {/* ── 서브스텝 2: 사내/외 데이터 비교 ── */}
      {pageStep === 2 && (
        <>
          <ConfidentialMatchCard />

          <PriceSummarySelector />

          <GlobalBidHistory />

          {submitError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between pb-4">
            <button
              onClick={() => setPageStep(1)}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 px-4 py-2.5 rounded transition"
            >
              <ChevronLeft size={16} />
              이전 단계
            </button>

            <button
              onClick={onSubmit}
              disabled={submitting || status === "parsing"}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              {submitting ? "분석 중..." : "AI 분석 시작"}
            </button>
          </div>
        </>
      )}

      <AiChatBot mode="search" />

      <LoadingOverlay
        show={isExtracting}
        title="파일을 읽고 있어요"
        description="견적서에서 라인 아이템과 단가 합계를 추출 중입니다."
      />
      <LoadingOverlay
        show={isAnalyzing}
        title="AI 가 분석 중이에요"
        description="입력하신 항목들을 시장단가와 매칭하고 편차를 계산합니다."
      />
    </div>
  );
}
