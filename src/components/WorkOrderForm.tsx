"use client";

import { useState } from "react";

type WorkOrderType = "신규" | "재발급" | "Off-Line등록";

interface WorkOrderData {
  type: WorkOrderType;
  writer: string;
  docNumber: string;
  issueDate: string;
  projectName: string;
  issuer: string;
  contractName: string;
  title: string;
  workContent: string;
  representativeQty: string;
  subcontractAmount: string;
  workStartDate: string;
  workEndDate: string;
  inspectionMethod: string;
  inspectionTiming: string;
  paymentMethod: string;
  paymentTiming: string;
  rawMaterialCondition: string;
  priceAdjustment: string;
  others: string;
  paymentLinkage: string;
  attachments: string;
}

interface Props {
  initialProjectName?: string;
  initialAmount?: number | null;
  initialTitle?: string;
  initialRepresentativeQty?: string;
  initialIssueDate?: string;
  initialContractName?: string;
  initialDocNumber?: string;
  initialIssuer?: string;
}

export function WorkOrderForm({
  initialProjectName,
  initialAmount,
  initialTitle,
  initialRepresentativeQty,
  initialIssueDate,
  initialContractName,
  initialDocNumber,
  initialIssuer,
}: Props) {
  const [data, setData] = useState<WorkOrderData>({
    type: "신규",
    writer: initialIssuer ?? "",
    docNumber: initialDocNumber ?? "",
    issueDate: initialIssueDate ?? "",
    projectName: initialProjectName ?? "",
    issuer: initialIssuer ?? "",
    contractName: initialContractName ?? "",
    title: initialTitle ?? "",
    workContent: "",
    representativeQty: initialRepresentativeQty ?? "",
    subcontractAmount: initialAmount != null ? String(Math.round(initialAmount)) : "",
    workStartDate: "",
    workEndDate: "",
    inspectionMethod: "현장검사",
    inspectionTiming: "공사완료 후 즉시",
    paymentMethod: "계좌이체",
    paymentTiming: "기성 청구 후 30일 이내",
    rawMaterialCondition: "해당 없음",
    priceAdjustment: "계약 조건에 따름",
    others: "",
    paymentLinkage: "해당 없음",
    attachments: "",
  });

  function set<K extends keyof WorkOrderData>(k: K) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setData((d) => ({ ...d, [k]: e.target.value as WorkOrderData[K] }));
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
      {/* ── 왼쪽: 입력 폼 ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">작업지시서 입력</h2>
          <p className="text-xs text-slate-500 mt-0.5">수정 시 오른쪽 미리보기에 즉시 반영됩니다.</p>
        </div>

        <div className="max-h-[82vh] overflow-y-auto px-5 py-4 space-y-5">
          <FormGroup title="발급 정보">
            <FieldRow>
              <Field label="구분">
                <select value={data.type} onChange={set("type")} className={inputCls}>
                  <option value="신규">신규</option>
                  <option value="재발급">재발급</option>
                  <option value="Off-Line등록">Off-Line등록</option>
                </select>
              </Field>
              <Field label="작성자">
                <input value={data.writer} onChange={set("writer")} className={inputCls} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="문서번호">
                <input value={data.docNumber} onChange={set("docNumber")} placeholder="자동 채번 또는 직접 입력" className={inputCls} />
              </Field>
              <Field label="발급일">
                <input type="date" value={data.issueDate} onChange={set("issueDate")} className={inputCls} />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="당사자">
            <FieldRow>
              <Field label="프로젝트">
                <input value={data.projectName} onChange={set("projectName")} className={inputCls} />
              </Field>
              <Field label="발급자">
                <input value={data.issuer} onChange={set("issuer")} placeholder="발급 담당자명" className={inputCls} />
              </Field>
            </FieldRow>
            <Field label="계약 (협력사명)">
              <input value={data.contractName} onChange={set("contractName")} placeholder="협력사명" className={inputCls} />
            </Field>
          </FormGroup>

          <FormGroup title="본문">
            <Field label="제목">
              <input value={data.title} onChange={set("title")} className={inputCls} />
            </Field>
            <Field label="1. 공사 내용 *">
              <textarea value={data.workContent} onChange={set("workContent")} rows={4} className={inputCls + " resize-none"} />
            </Field>
            <FieldRow>
              <Field label="1-1. 대표수량, 단가 등 *">
                <textarea value={data.representativeQty} onChange={set("representativeQty")} rows={4} className={inputCls + " resize-none"} />
              </Field>
              <Field label="1-2. 하도급 대금 (원, 직접비) *">
                <input
                  type="text"
                  inputMode="numeric"
                  value={data.subcontractAmount ? Number(data.subcontractAmount.replace(/,/g, "")).toLocaleString() : ""}
                  onChange={(e) => setData(d => ({ ...d, subcontractAmount: e.target.value.replace(/,/g, "") }))}
                  className={inputCls + " tabular-nums"}
                  placeholder="0"
                />
                {data.subcontractAmount && (
                  <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                    ≈ {Number(data.subcontractAmount.replace(/,/g, "")).toLocaleString()}원
                  </p>
                )}
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="일정">
            <FieldRow>
              <Field label="2. 공사착수일 *">
                <input type="date" value={data.workStartDate} onChange={set("workStartDate")} className={inputCls} />
              </Field>
              <Field label="2-1. 공사완료일 *">
                <input type="date" value={data.workEndDate} onChange={set("workEndDate")} className={inputCls} />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="검사 / 대금 지급">
            <FieldRow>
              <Field label="3. 검사의 방법 *">
                <input value={data.inspectionMethod} onChange={set("inspectionMethod")} className={inputCls} />
              </Field>
              <Field label="3-1. 검사의 시기 *">
                <input value={data.inspectionTiming} onChange={set("inspectionTiming")} className={inputCls} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="4. 대금 지급방법 *">
                <input value={data.paymentMethod} onChange={set("paymentMethod")} className={inputCls} />
              </Field>
              <Field label="4-1. 대금 지급시기 *">
                <input value={data.paymentTiming} onChange={set("paymentTiming")} className={inputCls} />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="추가 조건">
            <Field label="5. 원재료 지급시 조건 *">
              <textarea value={data.rawMaterialCondition} onChange={set("rawMaterialCondition")} rows={2} className={inputCls + " resize-none"} />
            </Field>
            <Field label="6. 공급원가 변동에 따른 하도급 대금의 조정 *">
              <textarea value={data.priceAdjustment} onChange={set("priceAdjustment")} rows={2} className={inputCls + " resize-none"} />
            </Field>
            <Field label="7. 기타">
              <textarea value={data.others} onChange={set("others")} rows={2} className={inputCls + " resize-none"} />
            </Field>
            <Field label="8. 하도급대금 연동에 관한 사항">
              <textarea value={data.paymentLinkage} onChange={set("paymentLinkage")} rows={2} className={inputCls + " resize-none"} />
            </Field>
            <Field label="9. 첨부파일">
              <input value={data.attachments} onChange={set("attachments")} placeholder="첨부파일 명/경로" className={inputCls} />
            </Field>
          </FormGroup>
        </div>
      </div>

      {/* ── 오른쪽: 실시간 미리보기 ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">작업지시서 미리보기</h2>
            <p className="text-xs text-slate-500 mt-0.5">입력값이 공문서 양식으로 실시간 표시됩니다.</p>
          </div>
        </div>
        <div className="max-h-[82vh] overflow-y-auto px-5 py-4">
          <WorkOrderPreview data={data} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────

const inputCls =
  "w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent";

function FormGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2 pb-1 border-b border-slate-100">
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ─────────────────────────────────────────────
// 공문서 스타일 미리보기 (실시간)
// ─────────────────────────────────────────────

function WorkOrderPreview({ data }: { data: WorkOrderData }) {
  const amtNum = Number(data.subcontractAmount.replace(/,/g, ""));
  return (
    <div className="bg-white border-2 border-slate-700 p-4 text-[11px] text-slate-900 leading-snug">
      <table className="w-full border-collapse">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[28%]" />
          <col className="w-[22%]" />
          <col className="w-[28%]" />
        </colgroup>
        <tbody>
          <PreviewRow>
            <LC>구 분</LC>
            <VC colSpan={3}>
              <CB on={data.type === "신규"}>신규</CB>
              <CB on={data.type === "재발급"}>재발급</CB>
              <CB on={data.type === "Off-Line등록"}>Off-Line등록</CB>
            </VC>
          </PreviewRow>
          <PreviewRow>
            <LC>작 성 자</LC>
            <VC colSpan={3}>{data.writer}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>문서번호</LC>
            <VC>{data.docNumber}</VC>
            <LC>발 급 일</LC>
            <VC>{data.issueDate}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>프로젝트</LC>
            <VC>{data.projectName}</VC>
            <LC>발 급 자</LC>
            <VC>{data.issuer}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>계 약 (협력사명)</LC>
            <VC colSpan={3}>{data.contractName}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>제 목</LC>
            <VC colSpan={3}>{data.title}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>1. 공사 내용*</LC>
            <VC colSpan={3} multiline>{data.workContent}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>1-1. 대표수량, 단가 등*</LC>
            <VC multiline>{data.representativeQty}</VC>
            <LC>1-2. 하도급 대금{"\n"}(단위: 원, 직접비)*</LC>
            <VC>{amtNum > 0 ? amtNum.toLocaleString() : data.subcontractAmount}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>2. 공사착수일*</LC>
            <VC>{data.workStartDate}</VC>
            <LC>2-1. 공사완료일*</LC>
            <VC>{data.workEndDate}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>3. 검사의 방법*</LC>
            <VC>{data.inspectionMethod}</VC>
            <LC>3-1. 검사의 시기*</LC>
            <VC>{data.inspectionTiming}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>4. 대금 지급방법*</LC>
            <VC>{data.paymentMethod}</VC>
            <LC>4-1. 대금 지급시기*</LC>
            <VC>{data.paymentTiming}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>5. 원재료 지급시 조건*</LC>
            <VC colSpan={3} multiline>{data.rawMaterialCondition}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>6. 공급원가 변동에 따른{"\n"}하도급 대금의 조정*</LC>
            <VC colSpan={3} multiline>{data.priceAdjustment}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>7. 기타</LC>
            <VC colSpan={3} multiline>{data.others}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>8. 하도급대금 연동에{"\n"}관한 사항</LC>
            <VC colSpan={3} multiline>{data.paymentLinkage}</VC>
          </PreviewRow>
          <PreviewRow>
            <LC>9. 첨부파일</LC>
            <VC colSpan={3}>{data.attachments}</VC>
          </PreviewRow>
        </tbody>
      </table>

      <ul className="mt-4 space-y-1 text-[10px] text-slate-600 leading-relaxed">
        <li>○ 상기 내용은 진행, 협의 등 상황에 따라 변동 될 수 있습니다.</li>
        <li>○ 협력사에서는 반드시 전자서명 완료 후에 작업에 착수해 주시기 바랍니다(예정 공사착수일 이후 서명 시 서명일이 공사착수일).</li>
        <li>○ 향후 수급사업자의 귀책, 기존 계약범위에 포함 등의 사유로 추가/변경작업이 아닌 것으로 객관적으로 확인될 경우 본 서면은 무효입니다.</li>
      </ul>

      <div className="mt-4 flex justify-end">
        <div className="text-right leading-tight">
          <div className="text-[12px] font-bold text-slate-800">posco</div>
          <div className="text-[10px] text-slate-600">포스코이앤씨</div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ children }: { children: React.ReactNode }) {
  return <tr>{children}</tr>;
}

const cellBase = "border border-slate-700 px-2 py-1.5 align-top";

function LC({ children }: { children: React.ReactNode }) {
  return (
    <td className={`${cellBase} bg-slate-100 font-medium text-[10px] whitespace-pre-line w-[22%]`}>
      {children}
    </td>
  );
}

function VC({ children, colSpan, multiline }: { children: React.ReactNode; colSpan?: number; multiline?: boolean }) {
  return (
    <td
      className={`${cellBase} text-[10px] ${multiline ? "whitespace-pre-wrap min-h-[36px]" : ""}`}
      colSpan={colSpan}
    >
      {children || <span className="text-slate-300">—</span>}
    </td>
  );
}

function CB({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5 mr-3">
      <span>{on ? "☑" : "☐"}</span>
      <span>{children}</span>
    </span>
  );
}
