"use client";

import { create } from "zustand";
import type {
  ParsedQuoteItem,
  ParsedQuoteMeta,
  ParsedQuoteCostSummary,
} from "@/lib/openai/types";

export type ExtractStatus =
  | "idle"
  | "uploading"
  | "parsing"
  | "extracted"
  | "error";

export interface QuoteRow {
  itemName: string;
  spec: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_ROW: QuoteRow = {
  itemName: "",
  spec: "",
  unit: "",
  quantity: "",
  unitPrice: "",
};

export interface RequestForm {
  // A) 요청 기본 정보 — 자동 매칭의 키
  workType: string; // 공종
  projectName: string; // 공사명
  spec: string; // 공사 규격
  reviewReason: string; // 검토 사유

  // B) 공사 내역 정보 (다중 행)
  items: QuoteRow[];

  // C) 단가 정보 (총 합계)
  partnerPrice: string;
  materialCost: string;
  laborCost: string;
  expenseCost: string;

  // 메모
  notes: string;
}

const EMPTY_FORM: RequestForm = {
  workType: "",
  projectName: "",
  spec: "",
  reviewReason: "신규 단가 검토",
  items: [{ ...EMPTY_ROW }],
  partnerPrice: "",
  materialCost: "",
  laborCost: "",
  expenseCost: "",
  notes: "",
};

export interface ExtractionSummary {
  fileName: string;
  fileSize: number;
  itemCount: number;
  totalPrice: number | null;
  meta: ParsedQuoteMeta;
  costSummary: ParsedQuoteCostSummary;
}

export interface SelectedSummary {
  id: number;
  name: string;
  spec: string | null;
  unit: string | null;
  totalCost: number | null;
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  sourceFile: string | null;
  sourceVia: string | null;
  projectName: string | null;
  businessDivision: string | null;
  firstContractDate: string | null; // ISO 문자열 (API JSON 응답)
  lastContractDate: string | null;
  // 자동 매칭 결과 표시용 (선택 사항 — review/analyze 등에서는 무시)
  confidence?: number;
  method?: "embedding" | "deterministic";
}

export type AutoMatchStatus =
  | "idle"
  | "loading"
  | "matched"
  | "empty"
  | "error";
export type DataTab = "db" | "actual" | "bid";
export type AnalyzeTab = "summary" | "db" | "actual" | "bid" | "ai-matching";

type ScalarKey = Exclude<keyof RequestForm, "items">;

interface RequestState {
  file: File | null;
  status: ExtractStatus;
  errorMessage: string | null;
  extraction: ExtractionSummary | null;

  form: RequestForm;
  selectedSummary: SelectedSummary | null;
  autoMatch: {
    status: AutoMatchStatus;
    candidates: SelectedSummary[];
    error: string | null;
  };
  submitting: boolean;
  submitError: string | null;
  selectedCompetitorBidIds: number[];
  activeDataTab: DataTab;
  activeAnalyzeTab: AnalyzeTab;

  setFile: (file: File | null) => void;
  uploadAndExtract: () => Promise<void>;
  setFormField: <K extends ScalarKey>(key: K, value: RequestForm[K]) => void;
  setItemField: <K extends keyof QuoteRow>(
    index: number,
    key: K,
    value: QuoteRow[K]
  ) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  moveItem: (from: number, to: number) => void;
  setAutoMatchResult: (result: {
    status: AutoMatchStatus;
    candidates: SelectedSummary[];
    error?: string | null;
  }) => void;
  setSelectedSummary: (s: SelectedSummary | null) => void;
  toggleCompetitorBid: (id: number) => void;
  setActiveDataTab: (tab: DataTab) => void;
  setActiveAnalyzeTab: (tab: AnalyzeTab) => void;
  resetForm: () => void;
  submit: () => Promise<{ quotationId: number } | null>;
}

const EMPTY_META: ParsedQuoteMeta = {
  projectName: null,
  requester: null,
  partnerName: null,
  workType: null,
  spec: null,
  location: null,
};

const EMPTY_COST: ParsedQuoteCostSummary = {
  materialCost: null,
  laborCost: null,
  expenseCost: null,
  totalCost: null,
};

function numToStr(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? String(n) : "";
}

export const useRequestStore = create<RequestState>((set, get) => ({
  file: null,
  status: "idle",
  errorMessage: null,
  extraction: null,
  form: { ...EMPTY_FORM, items: [{ ...EMPTY_ROW }] },
  selectedSummary: null,
  autoMatch: {
    status: "idle",
    candidates: [],
    error: null,
  },
  submitting: false,
  submitError: null,
  selectedCompetitorBidIds: [],
  activeDataTab: "db",
  activeAnalyzeTab: "db",

  setFile: (file) => {
    set({
      file,
      status: file ? "uploading" : "idle",
      errorMessage: null,
      extraction: null,
    });
  },

  uploadAndExtract: async () => {
    const file = get().file;
    if (!file) return;
    set({ status: "parsing", errorMessage: null });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/quote/extract", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const items: ParsedQuoteItem[] = data.items ?? [];
      const meta: ParsedQuoteMeta = { ...EMPTY_META, ...(data.meta ?? {}) };
      const costSummary: ParsedQuoteCostSummary = {
        ...EMPTY_COST,
        ...(data.costSummary ?? {}),
      };

      const summed =
        costSummary.materialCost != null ||
        costSummary.laborCost != null ||
        costSummary.expenseCost != null
          ? (costSummary.materialCost ?? 0) +
            (costSummary.laborCost ?? 0) +
            (costSummary.expenseCost ?? 0)
          : null;
      const partnerTotal = costSummary.totalCost ?? summed ?? null;

      const formItems: QuoteRow[] =
        items.length === 0
          ? [{ ...EMPTY_ROW }]
          : items.map((it) => ({
              itemName: it.itemName ?? "",
              spec: it.spec ?? "",
              unit: it.unit ?? "",
              quantity:
                it.quantity != null && Number.isFinite(it.quantity)
                  ? String(it.quantity)
                  : "",
              unitPrice:
                it.unitPrice != null && Number.isFinite(it.unitPrice)
                  ? String(it.unitPrice)
                  : "",
            }));

      const extraction: ExtractionSummary = {
        fileName: data.fileName,
        fileSize: data.fileSize,
        itemCount: items.length,
        totalPrice: partnerTotal,
        meta,
        costSummary,
      };

      const currentForm = get().form;
      const nextForm: RequestForm = {
        ...currentForm,
        projectName: meta.projectName ?? currentForm.projectName,
        workType: meta.workType ?? currentForm.workType,
        spec: meta.spec ?? currentForm.spec,
        items: formItems,
        partnerPrice:
          partnerTotal != null
            ? String(partnerTotal)
            : currentForm.partnerPrice,
        materialCost:
          costSummary.materialCost != null
            ? numToStr(costSummary.materialCost)
            : currentForm.materialCost,
        laborCost:
          costSummary.laborCost != null
            ? numToStr(costSummary.laborCost)
            : currentForm.laborCost,
        expenseCost:
          costSummary.expenseCost != null
            ? numToStr(costSummary.expenseCost)
            : currentForm.expenseCost,
      };

      set({
        status: "extracted",
        extraction,
        form: nextForm,
      });
    } catch (err) {
      set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },

  setFormField: (key, value) => {
    set((s) => ({ form: { ...s.form, [key]: value } }));
  },

  setItemField: (index, key, value) => {
    set((s) => ({
      form: {
        ...s.form,
        items: s.form.items.map((row, i) =>
          i === index ? { ...row, [key]: value } : row
        ),
      },
    }));
  },

  addItem: () => {
    set((s) => ({
      form: { ...s.form, items: [...s.form.items, { ...EMPTY_ROW }] },
    }));
  },

  removeItem: (index) => {
    set((s) => {
      const filtered = s.form.items.filter((_, i) => i !== index);
      return {
        form: {
          ...s.form,
          items: filtered.length === 0 ? [{ ...EMPTY_ROW }] : filtered,
        },
      };
    });
  },

  moveItem: (from, to) => {
    set((s) => {
      const items = s.form.items;
      if (
        from === to ||
        from < 0 ||
        from >= items.length ||
        to < 0 ||
        to >= items.length
      ) {
        return {};
      }
      const next = items.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { form: { ...s.form, items: next } };
    });
  },

  setAutoMatchResult: ({ status, candidates, error }) => {
    set({
      selectedSummary: candidates[0] ?? null,
      autoMatch: {
        status,
        candidates,
        error: error ?? null,
      },
    });
  },

  setSelectedSummary: (s) => {
    set({ selectedSummary: s });
  },

  toggleCompetitorBid: (id) => {
    set((s) => {
      const ids = s.selectedCompetitorBidIds;
      if (ids.includes(id)) {
        return { selectedCompetitorBidIds: ids.filter((x) => x !== id) };
      }
      if (ids.length >= 3) return {};
      return { selectedCompetitorBidIds: [...ids, id] };
    });
  },

  setActiveDataTab: (tab) => {
    set({ activeDataTab: tab });
  },

  setActiveAnalyzeTab: (tab) => {
    set({ activeAnalyzeTab: tab });
  },

  resetForm: () => {
    set({
      file: null,
      status: "idle",
      errorMessage: null,
      extraction: null,
      form: { ...EMPTY_FORM, items: [{ ...EMPTY_ROW }] },
      selectedSummary: null,
      autoMatch: {
        status: "idle",
        candidates: [],
        error: null,
      },
      submitError: null,
      selectedCompetitorBidIds: [],
    });
  },

  submit: async () => {
    const { form, extraction, selectedSummary, selectedCompetitorBidIds } =
      get();
    const validItems = form.items.filter((it) => it.itemName.trim() !== "");
    if (validItems.length === 0) {
      set({ submitError: "최소 1개의 품목이 필요합니다." });
      return null;
    }
    set({ submitting: true, submitError: null });
    try {
      const payload = {
        form: { ...form, items: validItems },
        fileName: extraction?.fileName ?? null,
        fileSize: extraction?.fileSize ?? null,
        priceSummaryId: selectedSummary?.id ?? null,
        selectedCompetitorBidIds: selectedCompetitorBidIds,
      };
      const res = await fetch("/api/quote/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      set({ submitting: false });
      return { quotationId: data.quotationId };
    } catch (err) {
      set({
        submitting: false,
        submitError: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  },
}));
