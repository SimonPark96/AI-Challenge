export interface ParsedQuoteItem {
  itemName: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface ParsedQuoteMeta {
  projectName: string | null;
  requester: string | null;
  partnerName: string | null;
  workType: string | null;
  location: string | null;
}

export interface ParsedQuoteCostSummary {
  materialCost: number | null;
  laborCost: number | null;
  expenseCost: number | null;
  totalCost: number | null;
}

export interface ParsedQuote {
  items: ParsedQuoteItem[];
  meta: ParsedQuoteMeta;
  costSummary: ParsedQuoteCostSummary;
  raw: unknown;
  via: "assistants" | "spreadsheet";
  debug?: Record<string, unknown>;
}
