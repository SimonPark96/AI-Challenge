import { ChevronRight } from "lucide-react";

interface Step {
  number: string;
  title: string;
  subtitle: string;
}

const STEPS: Step[] = [
  { number: "01", title: "단가 검토 요청", subtitle: "내역 및 업로드" },
  { number: "02", title: "AI 자동 분석", subtitle: "RAG 벡터 검색" },
  { number: "03", title: "적정 단가 검토", subtitle: "공사 사례 비교" },
  { number: "04", title: "결과 확정/연동", subtitle: "작업지시서 생성" },
];

export function StepIndicator({ activeStep }: { activeStep: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-6 py-5">
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === activeStep;
          const isPast = stepNum < activeStep;
          return (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isPast
                        ? "bg-blue-100 text-blue-600"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step.number}
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      isActive
                        ? "text-slate-900"
                        : isPast
                          ? "text-slate-700"
                          : "text-slate-400"
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {step.subtitle}
                  </div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight
                  className="text-slate-300 shrink-0 mx-2"
                  size={18}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
