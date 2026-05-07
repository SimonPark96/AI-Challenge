"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  X,
  Paperclip,
  FileText,
  LinkIcon,
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
  workType: { id: number; name: string } | null;
  quotation: { id: number; fileName: string } | null;
  receivedBids: { id: number; companyName: string | null; status: string }[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

// ── 결과 모달 (전송 완료 / 취소) ───────────────────────────────
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
  const [modal, setModal] = useState<null | "confirm" | "sent" | "cancelled">(null);
  const [sending, setSending] = useState(false);
  const [bidRequests, setBidRequests] = useState<BidRequest[]>([]);
  const [newWorkTypeName, setNewWorkTypeName] = useState("");
  const [newSubName, setNewSubName] = useState("");

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
    try {
      await Promise.all(
        targets.map(() =>
          fetch("/api/bid-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quotationId: linkedQuotationId,
              workTypeId: activeSubId,
              title: `${activeParent?.name} > ${activeSub.name} 견적 요청`,
              description: attachments.length > 0
                ? `첨부: ${attachments.map((f) => f.name).join(", ")}`
                : null,
            }),
          })
        )
      );
      setModal("sent");
      setSelected(new Set());
      setAttachments([]);
      const brRes = await fetch("/api/bid-request");
      setBidRequests((await brRes.json()).requests ?? []);
    } finally {
      setSending(false);
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
            <h1 className="text-2xl font-bold text-slate-800">경쟁 견적 요청</h1>
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
                placeholder="새 대공종" className="flex-1 min-w-0 border border-slate-300 rounded px-2 py-1 text-xs" />
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
                    placeholder="새 세부공종" className="flex-1 min-w-0 border border-slate-300 rounded px-2 py-1 text-xs" />
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
                            <th className="p-3 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSub.contacts.map((c) => (
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
                                <button onClick={() => deleteContact(activeSub.id, c.id)}
                                  className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                              </td>
                            </tr>
                          ))}
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

      {/* 발송 이력 */}
      {bidRequests.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Clock size={15} className="text-slate-400" /> 발송 이력
            </h2>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-600">공종</th>
                  <th className="text-left p-3 font-medium text-slate-600">제목</th>
                  <th className="text-left p-3 font-medium text-slate-600">발송일시</th>
                  <th className="text-left p-3 font-medium text-slate-600">상태</th>
                  <th className="text-left p-3 font-medium text-slate-600">수령 견적</th>
                </tr>
              </thead>
              <tbody>
                {bidRequests.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">{r.workType?.name ?? "-"}</td>
                    <td className="p-3 text-slate-600 text-xs">{r.title ?? "-"}</td>
                    <td className="p-3 text-xs font-mono text-slate-500">{fmtDate(r.sentAt)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === "sent" ? "bg-blue-100 text-blue-700" :
                        r.status === "received" ? "bg-emerald-100 text-emerald-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {r.status === "sent" ? "발송완료" : r.status === "received" ? "수령완료" : r.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {r.receivedBids.length > 0 ? `${r.receivedBids.length}건 수령` : "대기 중"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
