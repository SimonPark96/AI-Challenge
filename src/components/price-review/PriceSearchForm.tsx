"use client";

import { useState } from "react";
import {
  Search,
  RefreshCw,
  Info,
  Star,
  Volume2,
  PhoneCall,
  PanelsTopLeft,
} from "lucide-react";

interface Props {
  /** 페이지 타이틀 (DB단가 조회 / 실적 단가 조회 등) */
  title: string;
  /** 결과 영역 타이틀 (DB단가 목록 / 실적 단가 목록 등) */
  resultsTitle?: string;
}

/**
 * 협력사 견적 사례를 검색하기 위한 필터 폼 + 결과 테이블 골격.
 * 기능은 이후 backend 와 연결 예정 — 지금은 정적 UI 만.
 */
export function PriceSearchForm({ title, resultsTitle }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const oneYearAgo = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const [contractBase, setContractBase] = useState<"first" | "last">("last");

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-4">
      {/* 헤더 영역 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <Info size={14} />
            <Star size={14} />
            <PanelsTopLeft size={14} />
            <Volume2 size={14} />
            <PhoneCall size={14} />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-orange-500 font-medium">
            ※ 명칭 혹은 규격을 입력하여 조회하여 주십시오
          </span>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-medium border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition"
          >
            엑셀 다운로드
          </button>
          <button
            type="button"
            className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition"
          >
            조회
          </button>
        </div>
      </div>

      {/* 필터 폼 */}
      <div className="bg-white rounded border border-slate-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            {/* Row 1 — 상품 / 프로젝트 (각 2칸 차지) */}
            <FieldGroup label="상품" colSpan={2}>
              <Select placeholder="--전체--" />
              <Select placeholder="--전체--" />
              <IconBtn icon={<Search size={13} />} />
            </FieldGroup>
            <FieldGroup label="프로젝트" colSpan={2}>
              <TextInput />
              <TextInput />
              <IconBtn icon={<Search size={13} />} />
            </FieldGroup>

            {/* Row 2 */}
            <FieldGroup label="구분">
              <Select placeholder="--전체--" />
            </FieldGroup>
            <FieldGroup label="국내외구분">
              <Select placeholder="--전체--" />
            </FieldGroup>
            <FieldGroup label="소싱그룹명">
              <TextInput />
              <IconBtn icon={<Search size={13} />} />
            </FieldGroup>
            <FieldGroup label="계약업체">
              <TextInput />
              <IconBtn icon={<Search size={13} />} />
            </FieldGroup>

            {/* Row 3 */}
            <FieldGroup label="사업본부">
              <Select placeholder="--전체--" />
            </FieldGroup>
            <FieldGroup label="지역">
              <Select placeholder="--전체--" />
            </FieldGroup>
            <FieldGroup label="명칭1 검색">
              <TextInput />
            </FieldGroup>
            <FieldGroup label="명칭2 검색">
              <TextInput />
            </FieldGroup>

            {/* Row 4 */}
            <FieldGroup label="계약기준" required>
              <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="radio"
                  name="contractBase"
                  checked={contractBase === "first"}
                  onChange={() => setContractBase("first")}
                  className="accent-blue-600"
                />
                최초계약일
              </label>
              <label className="inline-flex items-center gap-1 text-xs text-slate-600 ml-2">
                <input
                  type="radio"
                  name="contractBase"
                  checked={contractBase === "last"}
                  onChange={() => setContractBase("last")}
                  className="accent-blue-600"
                />
                최종계약일
              </label>
            </FieldGroup>
            <FieldGroup label="계약일자">
              <input
                type="date"
                defaultValue={oneYearAgo}
                className={inputCls}
              />
              <span className="text-slate-400 text-xs">~</span>
              <input
                type="date"
                defaultValue={today}
                className={inputCls}
              />
            </FieldGroup>
            <FieldGroup label="조회항목수" required>
              <input
                type="text"
                defaultValue="1000"
                className={`${inputCls} text-right tabular-nums`}
              />
            </FieldGroup>
            <FieldGroup label="규격 검색">
              <TextInput />
            </FieldGroup>
          </div>

          {/* 우측 새로고침 버튼 */}
          <div className="flex items-center pl-1">
            <button
              type="button"
              className="text-blue-500 hover:text-blue-700 transition"
              title="필터 초기화"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 결과 테이블 */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-2">
          {resultsTitle ?? "실적 단가 목록"}
        </h2>
        <div className="bg-white border border-slate-200 rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="border-b border-slate-200">
                <Th cls="w-12">순번</Th>
                <Th>사업본부명</Th>
                <Th>발주공종명</Th>
                <Th>명칭</Th>
                <Th>규격</Th>
                <Th cls="w-16">단위</Th>
                <Th cls="text-right">계약수량</Th>
                <Th cls="w-20">계약통화</Th>
                <Th cls="text-right">재료비</Th>
                <Th cls="text-right">노무비</Th>
                <Th cls="text-right">경비</Th>
                <Th cls="text-right">단가합계</Th>
                <Th>소싱그룹명</Th>
                <Th>계약번호</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={14}
                  className="px-3 py-24 text-center text-xs text-slate-300"
                >
                  검색 결과가 표시될 영역입니다.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 내부 helpers
// ─────────────────────────────────────────────

const inputCls =
  "flex-1 min-w-0 border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400";

function FieldGroup({
  label,
  required,
  colSpan,
  children,
}: {
  label: string;
  required?: boolean;
  colSpan?: 1 | 2;
  children: React.ReactNode;
}) {
  const span = colSpan === 2 ? "md:col-span-2 lg:col-span-2" : "";
  return (
    <div className={`flex items-center gap-2 ${span}`}>
      <label className="text-xs text-slate-600 whitespace-nowrap shrink-0 w-20">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="flex items-center gap-1 flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Select({ placeholder }: { placeholder: string }) {
  return (
    <select className={inputCls} defaultValue="">
      <option value="">{placeholder}</option>
    </select>
  );
}

function TextInput() {
  return <input type="text" className={inputCls} />;
}

function IconBtn({ icon }: { icon: React.ReactNode }) {
  return (
    <button
      type="button"
      className="border border-slate-300 rounded px-1.5 py-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700 shrink-0"
    >
      {icon}
    </button>
  );
}

function Th({
  children,
  cls = "",
}: {
  children: React.ReactNode;
  cls?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left font-medium border-r border-slate-200 last:border-r-0 whitespace-nowrap ${cls}`}
    >
      {children}
    </th>
  );
}
