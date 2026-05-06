"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

type Tone = "slate" | "rose" | "blue" | "emerald";

interface Props {
  decisionLabel: string;
  decisionTone: Tone;
  /** AI 매칭 단가 합계 = Σ (marketPrice × quantity), 매칭된 행만. null 이면 매칭 없음. */
  itemMarketTotal: number | null;
  itemCount: number;
  matchedCount: number;
  matchRate: number;
  avgDev: number | null;
  overCount: number;
  underCount: number;
}

const cardCls: Record<Tone, string> = {
  slate: "bg-slate-50/70 border-slate-200",
  rose: "bg-rose-50/70 border-rose-200",
  blue: "bg-blue-50/70 border-blue-200",
  emerald: "bg-emerald-50/70 border-emerald-200",
};

const labelCls: Record<Tone, string> = {
  slate: "text-slate-700",
  rose: "text-rose-700",
  blue: "text-blue-700",
  emerald: "text-emerald-700",
};

export function ReviewDecisionCard({
  decisionLabel,
  decisionTone,
  itemMarketTotal,
  itemCount,
  matchedCount,
  matchRate,
  avgDev,
  overCount,
  underCount,
}: Props) {
  const [finalPrice, setFinalPrice] = useState<string>(
    itemMarketTotal != null && itemMarketTotal > 0
      ? String(Math.round(itemMarketTotal))
      : ""
  );
  const [userComment, setUserComment] = useState<string>("");

  return (
    <section className={`rounded-lg border p-6 ${cardCls[decisionTone]}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div
            className={`flex items-center gap-2 text-sm font-semibold ${labelCls[decisionTone]}`}
          >
            <CheckCircle2 size={18} />
            AI 검토 판정 — {decisionLabel}
          </div>
          <div className="mt-4">
            <div className="text-xs text-slate-500">AI 매칭 단가 합계</div>
            <div className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
              {itemMarketTotal != null && itemMarketTotal > 0
                ? `${Math.round(itemMarketTotal).toLocaleString()}원`
                : "-"}
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-600 space-y-0.5 leading-relaxed">
            <div>
              항목 <span className="font-semibold">{itemCount}건</span> · 매칭률{" "}
              <span className="font-semibold">
                {itemCount > 0
                  ? `${(matchRate * 100).toFixed(0)}% (${matchedCount}/${itemCount})`
                  : "-"}
              </span>
            </div>
            {avgDev !== null && (
              <div>
                평균 편차{" "}
                <span className="font-semibold">
                  {avgDev > 0 ? "+" : ""}
                  {avgDev.toFixed(1)}%
                </span>
              </div>
            )}
            {(overCount > 0 || underCount > 0) && (
              <div>
                시장 대비 비쌈{" "}
                <span className="font-semibold">{overCount}건</span> · 저렴{" "}
                <span className="font-semibold">{underCount}건</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            확정단가 (원)
          </label>
          <input
            type="number"
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
            placeholder="확정 단가 입력"
            className="mt-2 w-full border border-slate-300 rounded-md px-3 py-2 text-base bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            AI 매칭 단가 합계가 기본값으로 채워집니다. 필요 시 수정하세요.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700">
            사용자 검토의견
          </label>
          <textarea
            value={userComment}
            onChange={(e) => setUserComment(e.target.value)}
            placeholder="검토 의견을 입력하세요"
            rows={4}
            className="mt-2 w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </section>
  );
}
