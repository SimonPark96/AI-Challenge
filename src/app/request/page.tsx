"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RotateCcw } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { QuoteUpload } from "@/components/QuoteUpload";
import { RequestFormSection } from "@/components/RequestForm";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useRequestStore } from "@/lib/stores/request-store";

export default function RequestPage() {
  const router = useRouter();
  const submit = useRequestStore((s) => s.submit);
  const submitting = useRequestStore((s) => s.submitting);
  const submitError = useRequestStore((s) => s.submitError);
  const status = useRequestStore((s) => s.status);
  const resetForm = useRequestStore((s) => s.resetForm);
  const setActiveAnalyzeTab = useRequestStore((s) => s.setActiveAnalyzeTab);
  const [navigating, setNavigating] = useState(false);

  async function onSubmit() {
    const r = await submit();
    if (r) {
      setActiveAnalyzeTab("summary");
      setNavigating(true);
      router.push(`/analyze/${r.quotationId}`);
    }
  }

  function onReset() {
    if (
      window.confirm(
        "입력한 모든 내용(파일·요청 정보·품목·단가·매칭 선택)이 초기화됩니다. 진행할까요?"
      )
    ) {
      resetForm();
    }
  }

  const isExtracting = status === "parsing";
  const isAnalyzing = submitting || navigating;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">01. 단가 검토 요청</h1>
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

      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <span>📄</span> 협력사 견적서 / 일위대가 업로드
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              파일을 올리면 AI가 헤더 정보·라인 아이템·재료비/노무비/경비 합계를
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
          onClick={onSubmit}
          disabled={submitting || status === "parsing"}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={16} />
          {submitting ? "분석 중..." : "AI 자동 분석"}
        </button>
      </div>

      <LoadingOverlay
        show={isExtracting}
        title="파일을 읽고 있어요"
        description="견적서에서 라인 아이템과 단가 합계를 추출 중입니다."
      />
      <LoadingOverlay
        show={isAnalyzing}
        title="AI가 분석 중이에요"
        description="입력하신 항목들을 시장단가와 매칭하고 편차를 계산합니다."
      />
    </div>
  );
}
