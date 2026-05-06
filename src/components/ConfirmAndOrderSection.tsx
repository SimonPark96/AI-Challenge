"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Lock,
} from "lucide-react";

interface Props {
  quotationId: number;
  status: string;
}

/**
 * 04 페이지의 "검토 결과 확정 + 작업지시서 생성" 영역.
 *
 * - 체크박스는 *의도 표시*. DB 의 status 는 변경하지 않음.
 * - 체크된 상태에서만 작업지시서 생성 카드가 활성화되어 클릭 가능.
 * - 실제 status -> confirmed 전환은 작업지시서 페이지의 [결재요청] 버튼에서 일어남.
 * - 이미 confirmed (= 결재요청 완료) 면 체크박스가 잠긴 상태로 항상 체크.
 */
export function ConfirmAndOrderSection({ quotationId, status }: Props) {
  const isConfirmed = status === "confirmed";
  const [intentChecked, setIntentChecked] = useState<boolean>(isConfirmed);
  const checked = isConfirmed || intentChecked;

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">
          검토 결과 확정 및 작업지시서 생성
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          검토 결과 확정에 체크하면 작업지시서 생성으로 진행할 수 있습니다.
          실제 확정(대시보드 &ldquo;완료&rdquo; 탭 이동) 은 작업지시서 페이지의{" "}
          <span className="font-medium">[결재요청]</span> 버튼에서 이루어집니다.
        </p>
      </div>

      <label
        className={`flex items-start gap-3 border rounded-lg p-4 transition ${
          checked
            ? "border-blue-300 bg-blue-50/40"
            : "border-slate-200 hover:bg-slate-50 cursor-pointer"
        } ${isConfirmed ? "cursor-default" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={isConfirmed}
          onChange={(e) => setIntentChecked(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-blue-600 cursor-pointer disabled:cursor-default"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CheckCircle2
              size={16}
              className={checked ? "text-blue-600" : "text-slate-400"}
            />
            검토 결과 확정
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {isConfirmed
              ? "이미 결재요청이 완료되어 잠금 상태입니다."
              : "체크하면 아래 [작업지시서 생성] 카드가 활성화됩니다."}
          </p>
          <div className="text-[11px] text-slate-400 mt-1.5">
            현재 상태: <span className="font-mono">{status}</span>
          </div>
        </div>
      </label>

      {isConfirmed ? (
        <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg p-4 select-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                <Lock size={14} />
                작업지시서 생성 (잠금)
              </div>
              <div className="text-xs text-emerald-700/80 mt-1.5 leading-relaxed">
                결재요청이 완료된 건은 더 이상 작업지시서를 새로 생성할 수
                없습니다.
              </div>
            </div>
          </div>
        </div>
      ) : checked ? (
        <Link
          href={`/confirm/${quotationId}/work-order`}
          className="block border border-blue-300 bg-blue-50/40 rounded-lg p-4 hover:bg-blue-50 transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-blue-800 text-sm font-semibold">
                <FileSpreadsheet size={16} />
                작업지시서 생성
              </div>
              <div className="text-xs text-blue-700/80 mt-1.5 leading-relaxed">
                포스코이앤씨 양식의 작업지시서를 작성합니다.
              </div>
            </div>
            <ChevronRight size={16} className="text-blue-600 shrink-0" />
          </div>
        </Link>
      ) : (
        <div className="border border-slate-200 bg-slate-50/60 rounded-lg p-4 opacity-70 select-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                <Lock size={14} />
                작업지시서 생성
              </div>
              <div className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                상단 체크박스를 먼저 선택하세요.
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300 shrink-0" />
          </div>
        </div>
      )}
    </section>
  );
}
