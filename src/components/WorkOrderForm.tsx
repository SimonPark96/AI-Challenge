"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

type WorkOrderType = "신규" | "재발급" | "Off-Line등록";

interface WorkOrderData {
  type: WorkOrderType;
  writer: string;
  docNumber: string;
  issueDate: string;
  partnerApprovalDate: string;
  projectName: string;
  issuer: string;
  contractName: string;
  receiver: string;
  issuerSignature: string;
  receiverSignature: string;
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

const EMPTY: WorkOrderData = {
  type: "신규",
  writer: "박현우",
  docNumber: "",
  issueDate: "",
  partnerApprovalDate: "",
  projectName: "",
  issuer: "",
  contractName: "",
  receiver: "",
  issuerSignature: "",
  receiverSignature: "",
  title: "",
  workContent: "",
  representativeQty: "",
  subcontractAmount: "",
  workStartDate: "",
  workEndDate: "",
  inspectionMethod: "",
  inspectionTiming: "",
  paymentMethod: "",
  paymentTiming: "",
  rawMaterialCondition: "",
  priceAdjustment: "",
  others: "",
  paymentLinkage: "",
  attachments: "",
};

interface Props {
  initialProjectName?: string;
  initialAmount?: number | null;
  initialTitle?: string;
}

export function WorkOrderForm({
  initialProjectName,
  initialAmount,
  initialTitle,
}: Props) {
  const [data, setData] = useState<WorkOrderData>({
    ...EMPTY,
    projectName: initialProjectName ?? "",
    subcontractAmount: initialAmount != null ? String(initialAmount) : "",
    title: initialTitle ?? "",
  });
  const [preview, setPreview] = useState<WorkOrderData | null>(null);

  function set<K extends keyof WorkOrderData>(k: K) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => setData((d) => ({ ...d, [k]: e.target.value as WorkOrderData[K] }));
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            작업지시서 입력
          </h2>
          <button
            type="button"
            onClick={() => setPreview(data)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium inline-flex items-center gap-1.5"
          >
            <Eye size={14} />
            미리보기
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-5">
          <FormGroup title="발급 정보">
            <FieldRow>
              <Field label="구분">
                <select
                  value={data.type}
                  onChange={set("type")}
                  className={inputCls}
                >
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
                <input value={data.docNumber} onChange={set("docNumber")} className={inputCls} />
              </Field>
              <Field label="발급일">
                <input type="date" value={data.issueDate} onChange={set("issueDate")} className={inputCls} />
              </Field>
              <Field label="협력사승인일">
                <input type="date" value={data.partnerApprovalDate} onChange={set("partnerApprovalDate")} className={inputCls} />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="당사자 / 서명">
            <FieldRow>
              <Field label="프로젝트">
                <input value={data.projectName} onChange={set("projectName")} className={inputCls} />
              </Field>
              <Field label="발급자">
                <input value={data.issuer} onChange={set("issuer")} className={inputCls} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="계약">
                <input value={data.contractName} onChange={set("contractName")} className={inputCls} />
              </Field>
              <Field label="접수자">
                <input value={data.receiver} onChange={set("receiver")} className={inputCls} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="발급자 서명">
                <input value={data.issuerSignature} onChange={set("issuerSignature")} className={inputCls} />
              </Field>
              <Field label="접수자 서명">
                <input value={data.receiverSignature} onChange={set("receiverSignature")} className={inputCls} />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="본문">
            <Field label="제목">
              <input value={data.title} onChange={set("title")} className={inputCls} />
            </Field>
            <Field label="1. 공사 내용 *">
              <textarea value={data.workContent} onChange={set("workContent")} rows={3} className={inputCls + " resize-none"} />
            </Field>
            <FieldRow>
              <Field label="1-1. 대표수량, 단가 등 *">
                <textarea value={data.representativeQty} onChange={set("representativeQty")} rows={3} className={inputCls + " resize-none"} />
              </Field>
              <Field label="1-2. 하도급 대금 (원, 직접비) *">
                <input type="number" value={data.subcontractAmount} onChange={set("subcontractAmount")} className={inputCls + " tabular-nums"} />
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

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">미리보기</h2>
          {preview && (
            <span className="text-[11px] text-slate-400">
              [미리보기] 누른 시점의 입력값
            </span>
          )}
        </div>
        {preview ? (
          <WorkOrderPreview data={preview} />
        ) : (
          <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded p-12 text-center">
            좌측 입력 후 [미리보기] 버튼을 누르면 공문서 양식으로 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

function FormGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// === 공문서 스타일 미리보기 ===

function WorkOrderPreview({ data }: { data: WorkOrderData }) {
  return (
    <div className="bg-white border-2 border-slate-700 p-4 text-[11px] text-slate-900 leading-snug">
      <table className="w-full border-collapse">
        <colgroup>
          <col className="w-[18%]" />
          <col className="w-[32%]" />
          <col className="w-[18%]" />
          <col className="w-[32%]" />
        </colgroup>
        <tbody>
          <Row>
            <LabelCell>구 분</LabelCell>
            <ValueCell colSpan={3}>
              <CheckBox on={data.type === "신규"}>신규</CheckBox>{" "}
              <CheckBox on={data.type === "재발급"}>재발급</CheckBox>{" "}
              <CheckBox on={data.type === "Off-Line등록"}>Off-Line등록</CheckBox>
            </ValueCell>
          </Row>
          <Row>
            <LabelCell>작 성 자</LabelCell>
            <ValueCell colSpan={3}>{data.writer}</ValueCell>
          </Row>
          <Row>
            <LabelCell>문서번호</LabelCell>
            <ValueCell>{data.docNumber}</ValueCell>
            <LabelCell>발 급 일</LabelCell>
            <ValueCell>{data.issueDate}</ValueCell>
          </Row>
          <Row>
            <LabelCell>협력사승인일</LabelCell>
            <ValueCell colSpan={3}>{data.partnerApprovalDate}</ValueCell>
          </Row>
          <Row>
            <LabelCell>프로젝트</LabelCell>
            <ValueCell>{data.projectName}</ValueCell>
            <LabelCell>발 급 자</LabelCell>
            <ValueCell>{data.issuer}</ValueCell>
          </Row>
          <Row>
            <LabelCell>계 약</LabelCell>
            <ValueCell>{data.contractName}</ValueCell>
            <LabelCell>접 수 자</LabelCell>
            <ValueCell>{data.receiver}</ValueCell>
          </Row>
          <Row>
            <LabelCell>발급자 서명</LabelCell>
            <ValueCell>{data.issuerSignature}</ValueCell>
            <LabelCell>접수자 서명</LabelCell>
            <ValueCell>{data.receiverSignature}</ValueCell>
          </Row>
          <Row>
            <LabelCell>제 목</LabelCell>
            <ValueCell colSpan={3}>{data.title}</ValueCell>
          </Row>
          <Row>
            <LabelCell>1. 공사 내용*</LabelCell>
            <ValueCell colSpan={3} multiline>
              {data.workContent}
            </ValueCell>
          </Row>
          <Row>
            <LabelCell>1-1. 대표수량, 단가 등*</LabelCell>
            <ValueCell multiline>{data.representativeQty}</ValueCell>
            <LabelCell>
              1-2. 하도급 대금
              <br />
              (단위: 원, 직접비)*
            </LabelCell>
            <ValueCell>
              {data.subcontractAmount
                ? Number(data.subcontractAmount).toLocaleString()
                : ""}
            </ValueCell>
          </Row>
          <Row>
            <LabelCell>2. 공사착수일*</LabelCell>
            <ValueCell>{data.workStartDate}</ValueCell>
            <LabelCell>2-1. 공사완료일*</LabelCell>
            <ValueCell>{data.workEndDate}</ValueCell>
          </Row>
          <Row>
            <LabelCell>3. 검사의 방법*</LabelCell>
            <ValueCell>{data.inspectionMethod}</ValueCell>
            <LabelCell>3-1. 검사의 시기*</LabelCell>
            <ValueCell>{data.inspectionTiming}</ValueCell>
          </Row>
          <Row>
            <LabelCell>4. 대금 지급방법*</LabelCell>
            <ValueCell>{data.paymentMethod}</ValueCell>
            <LabelCell>4-1. 대금 지급시기*</LabelCell>
            <ValueCell>{data.paymentTiming}</ValueCell>
          </Row>
          <Row>
            <LabelCell>5. 원재료 지급시 조건*</LabelCell>
            <ValueCell colSpan={3} multiline>
              {data.rawMaterialCondition}
            </ValueCell>
          </Row>
          <Row>
            <LabelCell>
              6. 공급원가 변동에 따른
              <br />
              하도급 대금의 조정*
            </LabelCell>
            <ValueCell colSpan={3} multiline>
              {data.priceAdjustment}
            </ValueCell>
          </Row>
          <Row>
            <LabelCell>7. 기타</LabelCell>
            <ValueCell colSpan={3} multiline>
              {data.others}
            </ValueCell>
          </Row>
          <Row>
            <LabelCell>
              8. 하도급대금 연동에
              <br />
              관한 사항
            </LabelCell>
            <ValueCell colSpan={3} multiline>
              {data.paymentLinkage}
            </ValueCell>
          </Row>
          <Row>
            <LabelCell>9. 첨부파일</LabelCell>
            <ValueCell colSpan={3}>{data.attachments}</ValueCell>
          </Row>
        </tbody>
      </table>

      <ul className="mt-4 space-y-1 text-[10.5px] text-slate-700 leading-relaxed">
        <li>○ 상기 내용은 진행, 협의 등 상황에 따라 변동 될 수 있습니다.</li>
        <li>
          ○ 협력사에서는 반드시 전자서명 완료 후에 작업에 착수해 주시기
          바랍니다(예정 공사착수일 이후 서명 시 서명일이 공사착수일).
        </li>
        <li>
          ○ 향후 수급사업자의 귀책, 기존 계약범위에 포함 등의 사유로
          추가/변경작업이 아닌 것으로 객관적으로 확인될 경우 본 서면은
          무효입니다.
        </li>
      </ul>

      <div className="mt-4 flex justify-end">
        <div className="text-right">
          <div className="text-[11px] font-bold text-slate-800 leading-tight">
            posco
          </div>
          <div className="text-[10px] text-slate-700 leading-tight">
            포스코이앤씨
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <tr>{children}</tr>;
}

const cellBase = "border border-slate-700 px-2 py-1.5 align-top";

function LabelCell({ children }: { children: React.ReactNode }) {
  return (
    <td
      className={`${cellBase} bg-slate-100 font-medium text-[10.5px] whitespace-pre-line`}
    >
      {children}
    </td>
  );
}

function ValueCell({
  children,
  colSpan,
  multiline,
}: {
  children: React.ReactNode;
  colSpan?: number;
  multiline?: boolean;
}) {
  return (
    <td
      className={`${cellBase} text-[10.5px] ${multiline ? "whitespace-pre-wrap min-h-[40px]" : ""}`}
      colSpan={colSpan}
    >
      {children || " "}
    </td>
  );
}

function CheckBox({
  on,
  children,
}: {
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 mr-2">
      <span className="text-[11px]">{on ? "☑" : "☐"}</span>
      <span>{children}</span>
    </span>
  );
}
