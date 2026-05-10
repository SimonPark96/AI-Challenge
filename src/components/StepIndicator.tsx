"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { DataTabsBar } from "./DataTabsBar";

interface Step {
  number: string;
  title: string;
  subtitle: string;
}

const STEPS: Step[] = [
  { number: "01", title: "단가 검토 요청", subtitle: "내역 및 업로드" },
  { number: "02", title: "AI 자동 분석", subtitle: "자동 매칭 결과" },
  { number: "03", title: "적정 단가 검토", subtitle: "공사 사례 비교" },
  { number: "04", title: "결과 확정/연동", subtitle: "작업지시서 생성" },
];

function getStepPath(
  stepNum: number,
  quotationId: number | null | undefined
): string | null {
  if (stepNum === 1) return "/request";
  if (!quotationId) return null;
  if (stepNum === 2) return `/analyze/${quotationId}`;
  if (stepNum === 3) return `/review/${quotationId}`;
  if (stepNum === 4) return `/confirm/${quotationId}`;
  return null;
}

interface Props {
  activeStep: number;
  quotationId?: number | null;
  showDataTabs?: boolean;
  /** "inline" = 스토어 기반 탭 전환 (analyze/review/confirm 페이지)
   *  "header" = URL 기반 이동 (price-review 전용 페이지) — 기본값 */
  dataTabsVariant?: "inline" | "header";
}

export function StepIndicator({ activeStep, quotationId, showDataTabs, dataTabsVariant }: Props) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-5">
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === activeStep;
            const isPast = stepNum < activeStep;
            const path = getStepPath(stepNum, quotationId);
            const isNavigable = !isActive && path !== null;

            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    type="button"
                    disabled={!isNavigable}
                    onClick={() => path && router.push(path)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white cursor-default"
                        : isNavigable
                          ? "bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                    title={isNavigable ? `${step.title}으로 이동` : undefined}
                  >
                    {isPast ? <CheckCircle2 size={16} /> : step.number}
                  </button>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        isActive
                          ? "text-slate-900"
                          : isNavigable
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

      {showDataTabs && <DataTabsBar variant={dataTabsVariant ?? "header"} />}
    </div>
  );
}
