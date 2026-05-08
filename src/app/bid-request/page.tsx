"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Send,
  Plus,
  Trash2,
  Mail,
  Building2,
  User,
  Phone,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronDown,
  X,
  Paperclip,
  FileText,
  LinkIcon,
  Pencil,
  SlidersHorizontal,
  RotateCcw,
  Eye,
} from "lucide-react";

interface Contact {
  id: number;
  companyName: string;
  email: string;
  contactName: string | null;
  phone: string | null;
}

interface SubWorkType {
  id: number;
  name: string;
  description: string | null;
  contacts: Contact[];
}

interface WorkType {
  id: number;
  name: string;
  description: string | null;
  children: SubWorkType[];
}

interface BidRequest {
  id: number;
  status: string;
  sentAt: string | null;
  title: string | null;
  companyName: string | null;
  workType: { id: number; name: string } | null;
  quotation: { id: number; fileName: string } | null;
  receivedBids: {
    id: number;
    companyName: string | null;
    status: string;
    fileName: string;
    items: { materialCost: number | null; laborCost: number | null; expenseCost: number | null; totalCost: number | null }[];
  }[];
}

interface BidGroup {
  key: string;
  title: string | null;
  sentAt: string | null;
  workType: { id: number; name: string } | null;
  quotation: { id: number; fileName: string } | null;
  requests: BidRequest[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  // UTC+9 offset 적용으로 서버/클라이언트 모두 동일한 KST 결과 보장
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, "0")}.${String(kst.getUTCDate()).padStart(2, "0")} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
}

// ── 협력사 추가 폼 ──────────────────────────────────────────
function AddContactForm({
  subWorkTypeId,
  onAdded,
}: {
  subWorkTypeId: number;
  onAdded: (c: Contact) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ companyName: "", email: "", contactName: "", phone: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/work-types/${subWorkTypeId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAdded(data.contact);
      setForm({ companyName: "", email: "", contactName: "", phone: "" });
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded transition"
      >
        <Plus size={13} /> 협력사 추가
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-blue-50/60 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="text-xs font-semibold text-slate-700">협력사 추가</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-0.5">업체명 *</label>
          <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="(주)○○전기" required />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-0.5">이메일 *</label>
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="contact@company.com" required />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-0.5">담당자</label>
          <input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="홍길동" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-0.5">전화번호</label>
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="010-0000-0000" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)}
          className="text-xs text-slate-500 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50">취소</button>
        <button type="submit" disabled={saving}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded disabled:opacity-50">
          {saving ? "저장 중..." : "추가"}
        </button>
      </div>
    </form>
  );
}

// ── 협력사 인라인 수정 행 ────────────────────────────────────
function EditContactRow({
  contact,
  subId,
  onSaved,
  onCancel,
}: {
  contact: Contact;
  subId: number;
  onSaved: (c: Contact) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    companyName: contact.companyName,
    email: contact.email,
    contactName: contact.contactName ?? "",
    phone: contact.phone ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.companyName.trim() || !form.email.trim()) {
      alert("업체명·이메일은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/work-types/${subId}/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.contact);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-blue-100 bg-blue-50/40">
      <td className="p-2 text-center">
        <input type="checkbox" disabled className="rounded opacity-30" />
      </td>
      <td className="p-2">
        <input
          value={form.companyName}
          onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
          className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="업체명"
        />
      </td>
      <td className="p-2">
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="이메일"
        />
      </td>
      <td className="p-2">
        <input
          value={form.contactName}
          onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
          className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="담당자"
        />
      </td>
      <td className="p-2">
        <input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="전화번호"
        />
      </td>
      <td className="p-2">
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-xs text-slate-500 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── 파일 첨부 영역 ───────────────────────────────────────────
function AttachmentZone({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files];
    Array.from(incoming).forEach((f) => {
      if (!next.some((e) => e.name === f.name && e.size === f.size)) next.push(f);
    });
    onChange(next);
  }

  function remove(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <Paperclip size={13} />
        첨부 문서 (도면·사양서 등)
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <p className="text-xs text-slate-400">
          파일을 드래그하거나 클릭하여 선택 (PDF · DWG · XLSX 등)
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-3 py-1.5">
              <FileText size={13} className="text-blue-400 shrink-0" />
              <span className="text-xs text-slate-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => remove(i)} className="text-slate-300 hover:text-rose-500">
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 발송 확인 모달 ───────────────────────────────────────────
function ConfirmModal({
  sending,
  onYes,
  onNo,
}: {
  sending: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail size={28} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">메일을 전송하시겠습니까?</h3>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onNo}
            disabled={sending}
            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-95 transition-all duration-100 disabled:opacity-50"
          >
            아니요
          </button>
          <button
            onClick={onYes}
            disabled={sending}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm transition-all duration-100 disabled:opacity-70 inline-flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                전송 중...
              </>
            ) : (
              "예"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 결과 모달 ────────────────────────────────────────────────
function ResultModal({
  type,
  onClose,
}: {
  type: "sent" | "cancelled";
  onClose: () => void;
}) {
  const isSent = type === "sent";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isSent ? "bg-emerald-100" : "bg-slate-100"}`}>
            {isSent ? (
              <CheckCircle2 size={30} className="text-emerald-600" />
            ) : (
              <X size={28} className="text-slate-500" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {isSent ? "전송되었습니다." : "전송을 취소하였습니다."}
          </h3>
        </div>
        <button
          onClick={onClose}
          className={`w-full py-3 rounded-xl text-white font-semibold text-sm active:scale-95 transition-all duration-100 ${isSent ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-600 hover:bg-slate-700"}`}
        >
          확인
        </button>
      </div>
    </div>
  );
}

// ── 수령 견적 파일 미리보기 모달 ──────────────────────────────
type PreviewBid = {
  fileName: string;
  companyName: string | null;
  items: { materialCost: number | null; laborCost: number | null; expenseCost: number | null; totalCost: number | null }[];
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function FilePreviewModal({ bid, onClose }: { bid: PreviewBid; onClose: () => void }) {
  const cost = bid.items[0] ?? null;
  const rows = [
    { label: "재료비", value: cost?.materialCost },
    { label: "노무비", value: cost?.laborCost },
    { label: "경비",   value: cost?.expenseCost },
  ].filter((r) => r.value != null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="text-blue-500 shrink-0" />
            <span className="text-sm font-bold text-slate-800 truncate">{bid.fileName}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 transition">
            <X size={16} />
          </button>
        </div>

        {/* 업체명 */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <p className="text-[11px] text-slate-500 mb-0.5">업체명</p>
          <p className="text-sm font-semibold text-slate-800">{bid.companyName ?? "-"}</p>
        </div>

        {/* 비용 요약 */}
        <div className="px-5 py-4 space-y-1">
          <p className="text-xs font-semibold text-slate-600 mb-3">견적 비용 요약</p>
          {cost ? (
            <>
              {rows.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-sm font-mono text-slate-800">{fmtMoney(value)}</span>
                </div>
              ))}
              {cost.totalCost != null && (
                <div className="flex items-center justify-between mt-3 px-3 py-2.5 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-xs font-bold text-blue-700">합계</span>
                  <span className="text-base font-mono font-bold text-blue-700">{fmtMoney(cost.totalCost)}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">저장된 비용 데이터가 없습니다.</p>
          )}
        </div>

        {/* 하단 안내 */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">AI가 파싱한 비용 요약입니다. 원본 파일은 서버에 저장되지 않습니다.</p>
        </div>
      </div>
    </div>
  );
}

// ── 수령 견적 파일 업로드 셀 ─────────────────────────────────
function SampleUploadCell({
  bidRequestId,
  onUploaded,
}: {
  bidRequestId: number;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("companyName", "테스트");
      const res = await fetch(`/api/bid-request/${bidRequestId}/receive`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onUploaded();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1 text-[11px] text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded transition disabled:opacity-50"
      >
        <Paperclip size={10} />
        {uploading ? "등록 중..." : "업로드 필요"}
      </button>
    </span>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
function BidRequestPageInner() {
  const searchParams = useSearchParams();
  const linkedQuotationId = searchParams.get("quotationId")
    ? Number(searchParams.get("quotationId"))
    : null;
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeParentId, setActiveParentId] = useState<number | null>(null);
  const [activeSubId, setActiveSubId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [attachments, setAttachments] = useState<File[]>([]);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [modal, setModal] = useState<null | "confirm" | "sent" | "cancelled">(null);
  const [sending, setSending] = useState(false);
  const [bidRequests, setBidRequests] = useState<BidRequest[]>([]);
  const [newWorkTypeName, setNewWorkTypeName] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filterCompany, setFilterCompany] = useState("");
  const [filterWorkType, setFilterWorkType] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [previewBid, setPreviewBid] = useState<PreviewBid | null>(null);
  const [activeFilterCol, setActiveFilterCol] = useState<"company" | "workType" | "title" | "date" | "status" | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wtRes, brRes] = await Promise.all([
        fetch("/api/work-types"),
        fetch("/api/bid-request"),
      ]);
      const wtData = await wtRes.json();
      const brData = await brRes.json();
      const wts: WorkType[] = wtData.workTypes ?? [];
      setWorkTypes(wts);
      if (wts.length > 0 && activeParentId === null) {
        setActiveParentId(wts[0].id);
        if (wts[0].children.length > 0) setActiveSubId(wts[0].children[0].id);
      }
      setBidRequests(brData.requests ?? []);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function seed() {
    const res = await fetch("/api/work-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: true }),
    });
    const data = await res.json();
    const wts: WorkType[] = data.workTypes ?? [];
    setWorkTypes(wts);
    if (wts.length > 0) {
      setActiveParentId(wts[0].id);
      if (wts[0].children.length > 0) setActiveSubId(wts[0].children[0].id);
    }
  }

  async function addParent(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkTypeName.trim()) return;
    const res = await fetch("/api/work-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newWorkTypeName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setWorkTypes((prev) => [...prev, { ...data.workType, children: [] }]);
    setActiveParentId(data.workType.id);
    setActiveSubId(null);
    setNewWorkTypeName("");
  }

  async function addSub(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubName.trim() || !activeParentId) return;
    const res = await fetch("/api/work-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubName.trim(), parentId: activeParentId }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setWorkTypes((prev) =>
      prev.map((w) =>
        w.id === activeParentId
          ? { ...w, children: [...w.children, { ...data.workType, contacts: [] }] }
          : w
      )
    );
    setActiveSubId(data.workType.id);
    setNewSubName("");
  }

  async function deleteParent(id: number) {
    if (!confirm("이 대공종과 모든 세부공종·협력사를 삭제할까요?")) return;
    await fetch(`/api/work-types/${id}`, { method: "DELETE" });
    setWorkTypes((prev) => prev.filter((w) => w.id !== id));
    if (activeParentId === id) { setActiveParentId(null); setActiveSubId(null); }
  }

  async function deleteSub(parentId: number, subId: number) {
    if (!confirm("이 세부공종과 협력사를 삭제할까요?")) return;
    await fetch(`/api/work-types/${subId}`, { method: "DELETE" });
    setWorkTypes((prev) =>
      prev.map((w) => w.id === parentId ? { ...w, children: w.children.filter((c) => c.id !== subId) } : w)
    );
    if (activeSubId === subId) setActiveSubId(null);
  }

  function addContact(subId: number, contact: Contact) {
    setWorkTypes((prev) =>
      prev.map((w) => ({
        ...w,
        children: w.children.map((s) =>
          s.id === subId ? { ...s, contacts: [...s.contacts, contact] } : s
        ),
      }))
    );
  }

  function updateContact(subId: number, updated: Contact) {
    setWorkTypes((prev) =>
      prev.map((w) => ({
        ...w,
        children: w.children.map((s) =>
          s.id === subId
            ? { ...s, contacts: s.contacts.map((c) => c.id === updated.id ? updated : c) }
            : s
        ),
      }))
    );
  }

  async function deleteContact(subId: number, contactId: number) {
    if (!confirm("이 협력사를 삭제할까요?")) return;
    await fetch(`/api/work-types/${subId}/contacts/${contactId}`, { method: "DELETE" });
    setWorkTypes((prev) =>
      prev.map((w) => ({
        ...w,
        children: w.children.map((s) =>
          s.id === subId ? { ...s, contacts: s.contacts.filter((c) => c.id !== contactId) } : s
        ),
      }))
    );
    setSelected((prev) => { const next = new Set(prev); next.delete(contactId); return next; });
  }

  async function sendRequest() {
    if (!activeSub) return;
    const targets = activeSub.contacts.filter((c) => selected.has(c.id));
    if (targets.length === 0) return;
    setSending(true);
    const autoTitle = `${activeParent?.name} > ${activeSub.name} 견적 요청`;
    try {
      const results = await Promise.all(
        targets.map((contact) =>
          fetch("/api/bid-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quotationId: linkedQuotationId,
              workTypeId: activeSubId,
              companyName: contact.companyName,
              title: mailSubject.trim() || autoTitle,
              description: mailBody.trim() || (attachments.length > 0
                ? `첨부: ${attachments.map((f) => f.name).join(", ")}`
                : null),
            }),
          })
        )
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        const errData = await failed[0].json().catch(() => ({}));
        throw new Error(errData.error ?? `발송 오류 (HTTP ${failed[0].status})`);
      }

      setModal("sent");
      setSelected(new Set());
      setAttachments([]);
      setMailSubject("");
      setMailBody("");
      const brRes = await fetch("/api/bid-request");
      setBidRequests((await brRes.json()).requests ?? []);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // 발송 이력 그룹화: 동일 title + workTypeId + sentAt 1분 이내 → 하나의 그룹
  const bidGroups = useMemo<BidGroup[]>(() => {
    const groups: BidGroup[] = [];
    for (const req of bidRequests) {
      const reqTime = req.sentAt ? new Date(req.sentAt).getTime() : 0;
      const match = groups.find((g) => {
        const gTime = g.sentAt ? new Date(g.sentAt).getTime() : 0;
        return (
          g.title === req.title &&
          g.workType?.id === req.workType?.id &&
          Math.abs(gTime - reqTime) < 60_000
        );
      });
      if (match) {
        match.requests.push(req);
      } else {
        groups.push({
          key: `${req.title ?? ""}_${req.workType?.id ?? 0}_${req.sentAt ?? req.id}`,
          title: req.title,
          sentAt: req.sentAt,
          workType: req.workType,
          quotation: req.quotation,
          requests: [req],
        });
      }
    }
    return groups;
  }, [bidRequests]);

  const filteredGroups = useMemo<BidGroup[]>(() => {
    return bidGroups.filter((group) => {
      if (filterCompany.trim()) {
        const term = filterCompany.trim().toLowerCase();
        const match = group.requests.some((r) =>
          r.companyName?.toLowerCase().includes(term)
        );
        if (!match) return false;
      }
      if (filterWorkType.trim()) {
        const term = filterWorkType.trim().toLowerCase();
        if (!group.workType?.name.toLowerCase().includes(term)) return false;
      }
      if (filterTitle.trim()) {
        const term = filterTitle.trim().toLowerCase();
        if (!group.title?.toLowerCase().includes(term)) return false;
      }
      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        const sent = group.sentAt ? new Date(group.sentAt) : null;
        if (!sent || sent < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999);
        const sent = group.sentAt ? new Date(group.sentAt) : null;
        if (!sent || sent > to) return false;
      }
      if (filterStatus) {
        const allReceived = group.requests.every((r) => r.status === "received");
        const anyReceived = group.requests.some((r) => r.status === "received");
        if (filterStatus === "received" && !allReceived) return false;
        if (filterStatus === "partial" && !(anyReceived && !allReceived)) return false;
        if (filterStatus === "sent" && anyReceived) return false;
      }
      return true;
    });
  }, [bidGroups, filterCompany, filterWorkType, filterTitle, filterDateFrom, filterDateTo, filterStatus]);

  const activeFilterCount = [filterCompany, filterWorkType, filterTitle, filterDateFrom, filterDateTo, filterStatus].filter(Boolean).length;

  function resetFilters() {
    setFilterCompany("");
    setFilterWorkType("");
    setFilterTitle("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStatus("");
  }

  function handleFilterClick(
    col: "company" | "workType" | "title" | "date" | "status",
    e: React.MouseEvent<HTMLButtonElement>
  ) {
    e.stopPropagation();
    if (activeFilterCol === col) { setActiveFilterCol(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    setActiveFilterCol(col);
  }

  function clearCurrentColFilter() {
    switch (activeFilterCol) {
      case "company":  setFilterCompany(""); break;
      case "workType": setFilterWorkType(""); break;
      case "title":    setFilterTitle(""); break;
      case "date":     setFilterDateFrom(""); setFilterDateTo(""); break;
      case "status":   setFilterStatus(""); break;
    }
  }

  const activeParent = workTypes.find((w) => w.id === activeParentId) ?? null;
  const activeSub = activeParent?.children.find((s) => s.id === activeSubId) ?? null;
  const allSelected =
    !!activeSub &&
    activeSub.contacts.length > 0 &&
    activeSub.contacts.every((c) => selected.has(c.id));

  function toggleAll() {
    if (!activeSub) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) activeSub.contacts.forEach((c) => next.delete(c.id));
      else activeSub.contacts.forEach((c) => next.add(c.id));
      return next;
    });
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">3사 견적 요청</h1>
            <p className="text-sm text-slate-500 mt-1">
              공종별 협력사에 동일 스펙 도면을 첨부한 견적 요청을 발송합니다.
            </p>
          </div>
          {linkedQuotationId && (
            <Link
              href={`/review/${linkedQuotationId}`}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
            >
              <LinkIcon size={12} /> 단가 검토 요청 #{linkedQuotationId} 연결됨
            </Link>
          )}
        </div>
      </header>

      {/* 공종 없을 때 */}
      {workTypes.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-4">
          <Building2 size={40} className="text-slate-300 mx-auto" />
          <p className="text-slate-500 text-sm">등록된 공종이 없습니다.</p>
          <button onClick={seed}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm">
            <Plus size={15} /> 기본 공종 추가 (건축·전기·설비·토목·소방·통신)
          </button>
        </div>
      )}

      {workTypes.length > 0 && (
        <div className="grid grid-cols-12 gap-4">

          {/* ── 대공종 목록 ── */}
          <div className="col-span-2 space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">대공종</div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {workTypes.map((w) => (
                <div key={w.id} className="group relative">
                  <button
                    onClick={() => {
                      setActiveParentId(w.id);
                      setActiveSubId(w.children[0]?.id ?? null);
                      setSelected(new Set());
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-sm transition border-b border-slate-100 last:border-0 ${
                      activeParentId === w.id
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{w.name}</span>
                    <ChevronRight size={13} className="shrink-0 opacity-50" />
                  </button>
                  <button
                    onClick={() => deleteParent(w.id)}
                    className="absolute right-7 top-1/2 -translate-y-1/2 hidden group-hover:block text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>

            {/* 대공종 추가 */}
            <form onSubmit={addParent} className="flex gap-1">
              <input value={newWorkTypeName} onChange={(e) => setNewWorkTypeName(e.target.value)}
                placeholder="대공종명 입력" className="flex-1 min-w-0 border border-slate-300 rounded px-2 py-1 text-xs" />
              <button type="submit" disabled={!newWorkTypeName.trim()}
                className="bg-slate-700 hover:bg-slate-800 text-white px-2 py-1 rounded text-xs disabled:opacity-40">
                <Plus size={12} />
              </button>
            </form>
          </div>

          {/* ── 세부공종 목록 ── */}
          <div className="col-span-2 space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
              세부공종 {activeParent ? `— ${activeParent.name}` : ""}
            </div>
            {activeParent ? (
              <>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {activeParent.children.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center">세부공종 없음</div>
                  ) : (
                    activeParent.children.map((s) => (
                      <div key={s.id} className="group relative">
                        <button
                          onClick={() => { setActiveSubId(s.id); setSelected(new Set()); }}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-xs transition border-b border-slate-100 last:border-0 ${
                            activeSubId === s.id
                              ? "bg-blue-50 text-blue-700 font-semibold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className="text-slate-400 font-normal">{s.contacts.length}개사</span>
                        </button>
                        <button
                          onClick={() => deleteSub(activeParent.id, s.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:block text-slate-300 hover:text-rose-500"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* 세부공종 추가 */}
                <form onSubmit={addSub} className="flex gap-1">
                  <input value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="세부공종명 입력" className="flex-1 min-w-0 border border-slate-300 rounded px-2 py-1 text-xs" />
                  <button type="submit" disabled={!newSubName.trim()}
                    className="bg-slate-700 hover:bg-slate-800 text-white px-2 py-1 rounded text-xs disabled:opacity-40">
                    <Plus size={12} />
                  </button>
                </form>
              </>
            ) : (
              <div className="text-xs text-slate-400 px-1">대공종을 선택하세요</div>
            )}
          </div>

          {/* ── 협력사 목록 + 발송 ── */}
          <div className="col-span-8 space-y-4">
            {activeSub ? (
              <>
                {/* 협력사 테이블 */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <Building2 size={15} className="text-blue-500" />
                    <span className="text-sm font-bold text-slate-800">
                      {activeParent?.name} &gt; {activeSub.name}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">협력사 목록</span>
                  </div>

                  {activeSub.contacts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      등록된 협력사가 없습니다. 아래에서 추가해주세요.
                    </div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-3 w-8">
                              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                            </th>
                            <th className="text-left p-3 font-medium text-slate-600 text-xs">
                              <Building2 size={12} className="inline mr-1" />업체명
                            </th>
                            <th className="text-left p-3 font-medium text-slate-600 text-xs">
                              <Mail size={12} className="inline mr-1" />이메일
                            </th>
                            <th className="text-left p-3 font-medium text-slate-600 text-xs">
                              <User size={12} className="inline mr-1" />담당자
                            </th>
                            <th className="text-left p-3 font-medium text-slate-600 text-xs">
                              <Phone size={12} className="inline mr-1" />연락처
                            </th>
                            <th className="p-3 w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSub.contacts.map((c) =>
                            editingContactId === c.id ? (
                              <EditContactRow
                                key={c.id}
                                contact={c}
                                subId={activeSub.id}
                                onSaved={(updated) => {
                                  updateContact(activeSub.id, updated);
                                  setEditingContactId(null);
                                }}
                                onCancel={() => setEditingContactId(null)}
                              />
                            ) : (
                              <tr key={c.id} className={`border-t border-slate-100 transition ${selected.has(c.id) ? "bg-blue-50/50" : "hover:bg-slate-50"}`}>
                                <td className="p-3 text-center">
                                  <input type="checkbox" checked={selected.has(c.id)}
                                    onChange={(e) => setSelected((prev) => {
                                      const next = new Set(prev);
                                      e.target.checked ? next.add(c.id) : next.delete(c.id);
                                      return next;
                                    })} className="rounded" />
                                </td>
                                <td className="p-3 font-medium text-slate-800">{c.companyName}</td>
                                <td className="p-3 text-blue-600 font-mono text-xs">{c.email}</td>
                                <td className="p-3 text-slate-600 text-xs">{c.contactName ?? "-"}</td>
                                <td className="p-3 text-slate-600 text-xs">{c.phone ?? "-"}</td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <button
                                      onClick={() => setEditingContactId(c.id)}
                                      className="text-slate-300 hover:text-blue-500 transition"
                                      title="수정"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      onClick={() => deleteContact(activeSub.id, c.id)}
                                      className="text-slate-300 hover:text-rose-500 transition"
                                      title="삭제"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="px-5 py-4 border-t border-slate-100">
                    <AddContactForm subWorkTypeId={activeSub.id} onAdded={(c) => addContact(activeSub.id, c)} />
                  </div>
                </div>

                {/* 파일 첨부 + 발송 */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                  <AttachmentZone files={attachments} onChange={setAttachments} />

                  {/* 메일 제목 / 내용 */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <Mail size={13} />
                      메일 내용
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={mailSubject}
                        onChange={(e) => setMailSubject(e.target.value)}
                        placeholder={`메일 제목 (기본: ${activeParent?.name ?? ""} > ${activeSub?.name ?? ""} 견적 요청)`}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <textarea
                        value={mailBody}
                        onChange={(e) => setMailBody(e.target.value)}
                        rows={3}
                        placeholder="메일 본문 내용을 입력하세요. (선택사항)"
                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="text-sm text-slate-600">
                      {selected.size > 0 ? (
                        <span><span className="font-semibold text-blue-700">{selected.size}개 업체</span> 선택됨</span>
                      ) : (
                        <span className="text-slate-400">업체를 선택하세요</span>
                      )}
                      {attachments.length > 0 && (
                        <span className="ml-3 text-slate-400 text-xs">· 첨부 {attachments.length}개</span>
                      )}
                    </div>
                    <button
                      onClick={() => setModal("confirm")}
                      disabled={selected.size === 0}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-all duration-100"
                    >
                      <Send size={15} /> 견적 요청 발송
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
                세부공종을 선택하면 협력사 목록이 표시됩니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 발송 이력 (그룹화 + 필터) ── */}
      {bidGroups.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* 헤더 */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Clock size={15} className="text-slate-400" /> 발송 이력
              {filteredGroups.length !== bidGroups.length && (
                <span className="text-xs font-normal text-slate-400">
                  ({filteredGroups.length}/{bidGroups.length}건 표시)
                </span>
              )}
            </h2>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
              >
                <RotateCcw size={12} />
                필터 초기화
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              </button>
            )}
          </div>

          {/* 테이블 */}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 w-10 text-center" />
                  {/* 수신처 */}
                  <th className="px-3 py-3 text-left">
                    <button
                      onClick={(e) => handleFilterClick("company", e)}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition ${filterCompany ? "text-blue-600" : "text-slate-600 hover:text-slate-800"}`}
                    >
                      수신처
                      <ChevronDown size={11} className={`transition-transform ${filterCompany ? "text-blue-500 rotate-180" : "text-slate-400"}`} />
                      {filterCompany && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </button>
                  </th>
                  {/* 공종 */}
                  <th className="px-3 py-3 text-left w-28">
                    <button
                      onClick={(e) => handleFilterClick("workType", e)}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition ${filterWorkType ? "text-blue-600" : "text-slate-600 hover:text-slate-800"}`}
                    >
                      공종
                      <ChevronDown size={11} className={`transition-transform ${filterWorkType ? "text-blue-500 rotate-180" : "text-slate-400"}`} />
                      {filterWorkType && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </button>
                  </th>
                  {/* 제목 */}
                  <th className="px-3 py-3 text-left">
                    <button
                      onClick={(e) => handleFilterClick("title", e)}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition ${filterTitle ? "text-blue-600" : "text-slate-600 hover:text-slate-800"}`}
                    >
                      제목
                      <ChevronDown size={11} className={`transition-transform ${filterTitle ? "text-blue-500 rotate-180" : "text-slate-400"}`} />
                      {filterTitle && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </button>
                  </th>
                  {/* 발송일시 */}
                  <th className="px-3 py-3 text-center w-36">
                    <button
                      onClick={(e) => handleFilterClick("date", e)}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition mx-auto ${(filterDateFrom || filterDateTo) ? "text-blue-600" : "text-slate-600 hover:text-slate-800"}`}
                    >
                      발송일시
                      <ChevronDown size={11} className={`transition-transform ${(filterDateFrom || filterDateTo) ? "text-blue-500 rotate-180" : "text-slate-400"}`} />
                      {(filterDateFrom || filterDateTo) && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </button>
                  </th>
                  {/* 상태 */}
                  <th className="px-3 py-3 text-center w-32">
                    <button
                      onClick={(e) => handleFilterClick("status", e)}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition mx-auto ${filterStatus ? "text-blue-600" : "text-slate-600 hover:text-slate-800"}`}
                    >
                      상태
                      <ChevronDown size={11} className={`transition-transform ${filterStatus ? "text-blue-500 rotate-180" : "text-slate-400"}`} />
                      {filterStatus && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </button>
                  </th>
                  {/* 첨부파일 */}
                  <th className="px-3 py-3 text-center w-44 text-xs font-medium text-slate-600">첨부파일</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      조건에 맞는 이력이 없습니다.
                    </td>
                  </tr>
                )}
                {filteredGroups.map((group) => {
                  const isMulti = group.requests.length > 1;
                  const isExpanded = expandedGroups.has(group.key);
                  const first = group.requests[0];
                  const totalReceived = group.requests.reduce((a, r) => a + r.receivedBids.length, 0);
                  const allReceived = group.requests.every((r) => r.status === "received");
                  const someReceived = group.requests.some((r) => r.status === "received");
                  // 그룹 전체 수령 견적 목록
                  const allBids = group.requests.flatMap((r) => r.receivedBids);

                  return (
                    <Fragment key={group.key}>
                      {/* 그룹 헤더 행 */}
                      <tr
                        className={`border-t border-slate-100 ${isMulti ? "cursor-pointer select-none" : ""} hover:bg-slate-50 transition`}
                        onClick={isMulti ? () => toggleGroup(group.key) : undefined}
                      >
                        <td className="px-3 py-3 text-center align-middle">
                          {isMulti && (
                            <ChevronDown
                              size={14}
                              className={`text-slate-400 transition-transform duration-150 mx-auto ${isExpanded ? "rotate-180" : ""}`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle font-medium text-slate-800 text-sm">
                          {isMulti ? (
                            <span className="flex items-center gap-2">
                              {first.companyName ?? "-"}
                              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                외 {group.requests.length - 1}개사
                              </span>
                            </span>
                          ) : (
                            first.companyName ?? "-"
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle text-slate-600 text-xs">{group.workType?.name ?? "-"}</td>
                        <td className="px-3 py-3 align-middle text-slate-600 text-xs">{group.title ?? "-"}</td>
                        <td className="px-3 py-3 align-middle text-center text-xs font-mono text-slate-500">{fmtDate(group.sentAt)}</td>
                        <td className="px-3 py-3 align-middle text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              allReceived
                                ? "bg-emerald-100 text-emerald-700"
                                : someReceived
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {allReceived ? "수령완료" : someReceived ? "일부수령" : "발송완료"}
                            </span>
                            <div className="text-[11px]">
                              {totalReceived > 0 ? (
                                <span className="text-emerald-600 font-medium">{totalReceived}건 수령</span>
                              ) : (
                                <span className="text-slate-400">대기 중</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle text-center">
                          <div className="inline-flex flex-col items-center gap-1.5">
                            {allBids.map((bid) => (
                              <span
                                key={bid.id}
                                className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded max-w-[160px] truncate cursor-pointer hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition group"
                                title={`${bid.fileName} — 더블클릭으로 미리보기`}
                                onDoubleClick={(e) => { e.stopPropagation(); setPreviewBid(bid); }}
                              >
                                <FileText size={10} className="text-blue-400 shrink-0 group-hover:text-blue-500" />
                                {bid.fileName}
                                <Eye size={9} className="text-slate-300 shrink-0 group-hover:text-blue-400 ml-0.5" />
                              </span>
                            ))}
                            {!isMulti && allBids.length === 0 && (
                              <SampleUploadCell bidRequestId={first.id} onUploaded={loadAll} />
                            )}
                            {isMulti && allBids.length === 0 && (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isMulti && isExpanded && group.requests.map((r) => {
                        return (
                          <tr key={`sub-${r.id}`} className="border-t border-slate-50 bg-slate-50/70">
                            <td className="px-3 py-2.5 align-middle" />
                            <td className="px-3 py-2.5 align-middle pl-8">
                              <span className="flex items-center gap-1.5 text-xs text-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                {r.companyName ?? "-"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 align-middle text-xs text-slate-400">{r.workType?.name ?? "-"}</td>
                            <td className="px-3 py-2.5 align-middle text-xs text-slate-400">{r.title ?? "-"}</td>
                            <td className="px-3 py-2.5 align-middle text-center text-xs font-mono text-slate-400">{fmtDate(r.sentAt)}</td>
                            <td className="px-3 py-2.5 align-middle text-center">
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  r.status === "received"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}>
                                  {r.status === "received" ? "수령완료" : "발송완료"}
                                </span>
                                <div className="text-[11px]">
                                  {r.receivedBids.length > 0 ? (
                                    <span className="text-emerald-600 font-medium">{r.receivedBids.length}건 수령</span>
                                  ) : (
                                    <span className="text-slate-400">대기 중</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 align-middle text-center">
                              <div className="inline-flex flex-col items-center gap-1.5">
                                {r.receivedBids.map((bid) => (
                                  <span
                                    key={bid.id}
                                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded max-w-[160px] truncate cursor-pointer hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition group"
                                    title={`${bid.fileName} — 더블클릭으로 미리보기`}
                                    onDoubleClick={(e) => { e.stopPropagation(); setPreviewBid(bid); }}
                                  >
                                    <FileText size={10} className="text-blue-400 shrink-0 group-hover:text-blue-500" />
                                    {bid.fileName}
                                    <Eye size={9} className="text-slate-300 shrink-0 group-hover:text-blue-400 ml-0.5" />
                                  </span>
                                ))}
                                {r.receivedBids.length === 0 && (
                                  <SampleUploadCell bidRequestId={r.id} onUploaded={loadAll} />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 엑셀 스타일 필터 드롭다운 ── */}
      {activeFilterCol && (
        <>
          {/* 배경 오버레이 - 외부 클릭 시 닫기 */}
          <div className="fixed inset-0 z-[99]" onClick={() => setActiveFilterCol(null)} />

          {/* 드롭다운 패널 */}
          <div
            className="fixed z-[100] bg-white rounded-lg border border-slate-200 shadow-2xl overflow-hidden"
            style={{ top: dropdownPos.top, left: dropdownPos.left, minWidth: 220 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 패널 헤더 */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5">
              <SlidersHorizontal size={11} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">
                {{ company: "수신처", workType: "공종", title: "제목", date: "발송일시", status: "상태" }[activeFilterCol]}
                {" "}필터
              </span>
            </div>

            {/* 텍스트 검색 (수신처 / 공종 / 제목) */}
            {(activeFilterCol === "company" || activeFilterCol === "workType" || activeFilterCol === "title") && (
              <div className="p-3">
                <input
                  autoFocus
                  type="text"
                  value={activeFilterCol === "company" ? filterCompany : activeFilterCol === "workType" ? filterWorkType : filterTitle}
                  onChange={(e) => {
                    if (activeFilterCol === "company") setFilterCompany(e.target.value);
                    else if (activeFilterCol === "workType") setFilterWorkType(e.target.value);
                    else setFilterTitle(e.target.value);
                  }}
                  placeholder={activeFilterCol === "company" ? "업체명 검색..." : activeFilterCol === "workType" ? "공종명 검색..." : "제목 검색..."}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  onKeyDown={(e) => { if (e.key === "Enter") setActiveFilterCol(null); }}
                />
                <p className="text-[11px] text-slate-400 mt-1.5">Enter 또는 확인 버튼으로 적용</p>
              </div>
            )}

            {/* 날짜 범위 (발송일시) */}
            {activeFilterCol === "date" && (
              <div className="p-3 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">시작일</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">종료일</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            )}

            {/* 상태 선택 */}
            {activeFilterCol === "status" && (
              <div className="py-1.5">
                {[
                  { value: "", label: "전체", icon: null },
                  { value: "sent", label: "발송완료", color: "bg-blue-100 text-blue-700" },
                  { value: "partial", label: "일부수령", color: "bg-amber-100 text-amber-700" },
                  { value: "received", label: "수령완료", color: "bg-emerald-100 text-emerald-700" },
                ].map(({ value, label, color }) => (
                  <label
                    key={value}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition ${filterStatus === value ? "bg-blue-50" : "hover:bg-slate-50"}`}
                  >
                    <input
                      type="radio"
                      name="bidFilterStatus"
                      checked={filterStatus === value}
                      onChange={() => setFilterStatus(value)}
                      className="text-blue-600 cursor-pointer"
                    />
                    {color ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
                    ) : (
                      <span className="text-xs text-slate-600">{label}</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {/* 하단 버튼 */}
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 bg-slate-50/80">
              <button
                onClick={clearCurrentColFilter}
                className="text-xs text-rose-500 hover:text-rose-700 transition flex items-center gap-1"
              >
                <RotateCcw size={11} /> 초기화
              </button>
              <button
                onClick={() => setActiveFilterCol(null)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded transition font-medium"
              >
                확인
              </button>
            </div>
          </div>
        </>
      )}

      {modal === "confirm" && (
        <ConfirmModal
          sending={sending}
          onYes={sendRequest}
          onNo={() => setModal("cancelled")}
        />
      )}
      {(modal === "sent" || modal === "cancelled") && (
        <ResultModal type={modal} onClose={() => setModal(null)} />
      )}
      {previewBid && (
        <FilePreviewModal bid={previewBid} onClose={() => setPreviewBid(null)} />
      )}
    </div>
  );
}

export default function BidRequestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">불러오는 중...</div>}>
      <BidRequestPageInner />
    </Suspense>
  );
}
