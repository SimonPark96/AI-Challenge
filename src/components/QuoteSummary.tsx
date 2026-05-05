interface Props {
  quotation: {
    id: number;
    fileName: string;
    uploadedAt: string | Date;
    status: string;
  };
  meta: Record<string, unknown> | null;
}

function s(v: unknown): string {
  return typeof v === "string" && v.trim() !== "" ? v : "-";
}

export function QuoteSummary({ quotation, meta }: Props) {
  const projectName = s(meta?.projectName);
  const workType = s(meta?.workType);
  const spec = s(meta?.spec);
  const reviewReason = s(meta?.reviewReason);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xs text-slate-500">
            Quotation #{quotation.id}
          </div>
          <div className="text-lg font-semibold text-slate-800 mt-0.5">
            {projectName}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {quotation.fileName}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">
            {new Date(quotation.uploadedAt).toLocaleString()}
          </div>
          <div className="mt-1 inline-block px-2 py-0.5 text-[11px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            {quotation.status}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border-t border-slate-100 pt-4">
        <Cell label="공종" value={workType} />
        <Cell label="규격" value={spec} />
        <Cell label="검토 사유" value={reviewReason} />
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm text-slate-700 mt-0.5">{value}</div>
    </div>
  );
}
