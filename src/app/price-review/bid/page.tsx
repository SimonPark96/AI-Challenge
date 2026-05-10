import { StepIndicator } from "@/components/StepIndicator";

export default function BidPricePage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">비교 견적</h1>
        <p className="text-sm text-slate-500 mt-1">3사 비교 견적 단가 검토</p>
      </header>

      <StepIndicator activeStep={1} showDataTabs />

      <div className="mt-4 p-16 border-2 border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-sm bg-white">
        기획 후 구현 예정
      </div>
    </div>
  );
}
