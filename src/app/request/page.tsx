"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { QuoteUpload } from "@/components/QuoteUpload";
import { RequestFormSection } from "@/components/RequestForm";
import { PriceSummarySelector } from "@/components/PriceSummarySelector";
import { useRequestStore } from "@/lib/stores/request-store";

export default function RequestPage() {
  const router = useRouter();
  const submit = useRequestStore((s) => s.submit);
  const submitting = useRequestStore((s) => s.submitting);
  const submitError = useRequestStore((s) => s.submitError);
  const status = useRequestStore((s) => s.status);

  async function onSubmit() {
    const r = await submit();
    if (r) router.push(`/review/${r.quotationId}`);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">
          01. 단가 검토 요청
        </h1>
      </header>

      <StepIndicator activeStep={1} />

      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
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

      <PriceSummarySelector />

      {submitError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3">
          {submitError}
        </div>
      )}

      <div className="flex justify-end pb-4">
        <button
          onClick={onSubmit}
          disabled={submitting || status === "parsing"}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles size={16} />
          {submitting ? "분석 중..." : "AI 분석 시작"}
        </button>
      </div>
    </div>
  );
}
