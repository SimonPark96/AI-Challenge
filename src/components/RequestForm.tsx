"use client";

import { useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  useRequestStore,
  type RequestForm,
  type QuoteRow,
} from "@/lib/stores/request-store";

export function RequestFormSection() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
      <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
        <span>📋</span> 단가 검토 요청 입력
      </h2>

      <SectionA />
      <SectionB />
      <SectionC />
      <NotesField />
    </div>
  );
}

function SectionTitle({ badge, title }: { badge: string; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[11px]">
        {badge}
      </span>
      <span>{title}</span>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-600">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

function inputClass(extra = "") {
  return `w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${extra}`;
}

function cellInputClass(extra = "") {
  return `w-full border border-slate-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${extra}`;
}

function SectionA() {
  const form = useRequestStore((s) => s.form);
  const setF = useRequestStore((s) => s.setFormField);
  const upd =
    <K extends Exclude<keyof RequestForm, "items">>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF(k, e.target.value as RequestForm[K]);

  return (
    <div>
      <SectionTitle badge="A" title="요청 기본 정보" />
      <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
        공사명 + 규격 입력 시 PriceSummary 의 가장 유사한 자료가 자동 매칭되어
        합계 비교에 사용됩니다.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="공종">
          <input
            value={form.workType}
            onChange={upd("workType")}
            placeholder="예: 철근콘크리트공사"
            className={inputClass()}
          />
        </Field>
        <Field
          label="공사명"
          required
          hint="자동 매칭의 핵심 키"
        >
          <input
            value={form.projectName}
            onChange={upd("projectName")}
            placeholder="예: 서울숲 오피스 신축공사"
            className={inputClass()}
          />
        </Field>
        <Field label="규격" hint="자동 매칭 보조 키">
          <input
            value={form.spec}
            onChange={upd("spec")}
            placeholder="예: SD400 D16 / THK10"
            className={inputClass()}
          />
        </Field>
        <Field label="검토 사유">
          <select
            value={form.reviewReason}
            onChange={upd("reviewReason")}
            className={inputClass()}
          >
            <option>신규 단가 검토</option>
            <option>재검토</option>
            <option>변경 단가 검토</option>
            <option>기타</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function SectionB() {
  const items = useRequestStore((s) => s.form.items);
  const setItem = useRequestStore((s) => s.setItemField);
  const addItem = useRequestStore((s) => s.addItem);
  const removeItem = useRequestStore((s) => s.removeItem);
  const moveItem = useRequestStore((s) => s.moveItem);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const trRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const updRow =
    <K extends keyof QuoteRow>(idx: number, k: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setItem(idx, k, e.target.value as QuoteRow[K]);

  function handleDragStart(idx: number) {
    return (e: React.DragEvent) => {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = "move";
      // Firefox 가 dataTransfer 비어있으면 drag 시작 자체를 무시함
      e.dataTransfer.setData("text/plain", String(idx));

      // 마우스를 따라가는 ghost 를 "행 전체 모양" 으로 만들기 위해
      // 임시 wrapper(table > tbody > 클론한 tr)를 화면 밖에 만들고 setDragImage 로 지정.
      // 직접 <tr> 을 setDragImage 에 넘기면 일부 브라우저가 layout 이 깨진 형태로 캡처함.
      const tr = trRefs.current[idx];
      if (tr) {
        const rect = tr.getBoundingClientRect();
        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.top = "-10000px";
        wrapper.style.left = "-10000px";
        wrapper.style.width = `${rect.width}px`;
        wrapper.style.background = "white";
        wrapper.style.border = "1px solid rgb(59 130 246)";
        wrapper.style.borderRadius = "6px";
        wrapper.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
        wrapper.style.pointerEvents = "none";
        wrapper.style.opacity = "0.95";

        const tableClone = document.createElement("table");
        tableClone.style.width = "100%";
        tableClone.style.borderCollapse = "collapse";
        tableClone.className = "text-sm";
        const tbodyClone = document.createElement("tbody");
        const trClone = tr.cloneNode(true) as HTMLTableRowElement;
        // 원본 tr 의 셀 width 를 보존
        const origCells = Array.from(tr.children) as HTMLElement[];
        const cloneCells = Array.from(trClone.children) as HTMLElement[];
        origCells.forEach((c, i) => {
          if (cloneCells[i]) cloneCells[i].style.width = `${c.offsetWidth}px`;
        });
        tbodyClone.appendChild(trClone);
        tableClone.appendChild(tbodyClone);
        wrapper.appendChild(tableClone);
        document.body.appendChild(wrapper);

        e.dataTransfer.setDragImage(
          wrapper,
          e.clientX - rect.left,
          e.clientY - rect.top
        );
        // ghost 캡처 후 즉시 제거 (브라우저가 이미 snapshot 을 잡음)
        window.setTimeout(() => wrapper.remove(), 0);
      }
    };
  }

  function handleDragOver(idx: number) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIdx !== null && idx !== overIdx) setOverIdx(idx);
    };
  }

  function handleDrop(idx: number) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== idx) moveItem(dragIdx, idx);
      setDragIdx(null);
      setOverIdx(null);
    };
  }

  function handleDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
  }

  return (
    <div>
      <SectionTitle badge="B" title="공사 내역 정보" />
      <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
        좌측{" "}
        <GripVertical size={11} className="inline-block align-text-bottom" />{" "}
        핸들을 드래그해 행 순서를 자유롭게 변경할 수 있습니다.
      </p>

      <div className="border border-slate-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="px-2 py-2 w-8" aria-label="드래그 핸들" />
              <th className="text-left px-2 py-2 font-medium w-10">#</th>
              <th className="text-left px-2 py-2 font-medium min-w-[180px]">
                품목 / 공종명 <span className="text-rose-500">*</span>
              </th>
              <th className="text-left px-2 py-2 font-medium min-w-[140px]">
                규격
              </th>
              <th className="text-left px-2 py-2 font-medium w-20">단위</th>
              <th className="text-right px-2 py-2 font-medium w-24">수량</th>
              <th className="text-right px-2 py-2 font-medium w-32">
                단가 (원)
              </th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const isDragging = dragIdx === i;
              const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
              return (
                <tr
                  key={i}
                  ref={(el) => {
                    trRefs.current[i] = el;
                  }}
                  onDragOver={handleDragOver(i)}
                  onDrop={handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  className={`transition ${
                    isOver
                      ? "border-t-2 border-blue-500 bg-blue-50/60"
                      : "border-t border-slate-100"
                  } ${isDragging ? "opacity-30 saturate-50" : ""}`}
                >
                  <td
                    className="px-2 py-1 text-center cursor-grab active:cursor-grabbing select-none"
                    draggable
                    onDragStart={handleDragStart(i)}
                    title="드래그하여 순서 변경"
                  >
                    <GripVertical
                      size={14}
                      className="text-slate-300 hover:text-slate-500 inline-block"
                    />
                  </td>
                  <td className="px-2 py-1 text-xs text-slate-400 font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      value={row.itemName}
                      onChange={updRow(i, "itemName")}
                      placeholder="자재명"
                      className={cellInputClass()}
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      value={row.spec}
                      onChange={updRow(i, "spec")}
                      placeholder="규격"
                      className={cellInputClass()}
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      value={row.unit}
                      onChange={updRow(i, "unit")}
                      placeholder="EA"
                      className={cellInputClass()}
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      value={row.quantity}
                      onChange={updRow(i, "quantity")}
                      placeholder="0"
                      className={cellInputClass("text-right")}
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      value={row.unitPrice}
                      onChange={updRow(i, "unitPrice")}
                      placeholder="0"
                      className={cellInputClass("text-right")}
                    />
                  </td>
                  <td className="px-1.5 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                      title="행 삭제"
                      className="text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={addItem}
          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          <Plus size={12} /> 행 추가
        </button>
        <div className="text-[11px] text-slate-400">
          총 {items.length}건 입력
        </div>
      </div>
    </div>
  );
}

function SectionC() {
  const form = useRequestStore((s) => s.form);
  const setF = useRequestStore((s) => s.setFormField);
  const upd =
    <K extends Exclude<keyof RequestForm, "items">>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF(k, e.target.value as RequestForm[K]);

  return (
    <div>
      <SectionTitle badge="C" title="단가 정보 (총 합계)" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="협력사 제시 단가 (원)">
          <input
            type="number"
            value={form.partnerPrice}
            onChange={upd("partnerPrice")}
            placeholder="0"
            className={inputClass("bg-blue-50/40")}
          />
        </Field>
        <Field label="재료비 (원)">
          <input
            type="number"
            value={form.materialCost}
            onChange={upd("materialCost")}
            placeholder="0"
            className={inputClass()}
          />
        </Field>
        <Field label="노무비 (원)">
          <input
            type="number"
            value={form.laborCost}
            onChange={upd("laborCost")}
            placeholder="0"
            className={inputClass()}
          />
        </Field>
        <Field label="경비 (원)">
          <input
            type="number"
            value={form.expenseCost}
            onChange={upd("expenseCost")}
            placeholder="0"
            className={inputClass()}
          />
        </Field>
      </div>
    </div>
  );
}

function NotesField() {
  const form = useRequestStore((s) => s.form);
  const setF = useRequestStore((s) => s.setFormField);
  return (
    <Field label="특기사항 / 요청 메모">
      <textarea
        value={form.notes}
        onChange={(e) => setF("notes", e.target.value)}
        rows={3}
        placeholder="검토 시 참고할 사항을 자유롭게 입력하세요."
        className={inputClass("resize-none")}
      />
    </Field>
  );
}
