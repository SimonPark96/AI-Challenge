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
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-mono">
              #{quotation.id}
            </span>
            <span className="text-sm font-semibold text-slate-800 truncate">
              {projectName}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {quotation.fileName}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] text-slate-400">
            {new Date(quotation.uploadedAt).toLocaleString()}
          </div>
          <div className="mt-0.5 inline-block px-1.5 py-0 text-[10px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            {quotation.status}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs border-t border-slate-100 pt-2">
        <Cell label="공종" value={workType} />
        <Cell label="규격" value={spec} />
        <Cell label="검토 사유" value={reviewReason} />
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-xs text-slate-700 mt-0.5 truncate">{value}</div>
    </div>
  );
}
