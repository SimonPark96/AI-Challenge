"use client";

import { useEffect, useState } from "react";
import {
  ListChecks,
  Loader2,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";

interface Summary {
  total: number;
  inProgress: number;
  completed: number;
  failed: number;
  avgDeviationPct: number | null;
  maxDeviationPct: number | null;
  lastUploadedAt: string | null;
}

export function DashboardSummary({
  onChange,
}: {
  onChange?: (s: Summary) => void;
}) {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) {
          setData(d);
          onChange?.(d);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card
        icon={<ListChecks size={16} />}
        label="전체 분석"
        value={data?.total ?? "-"}
        tone="slate"
      />
      <Card
        icon={<Loader2 size={16} />}
        label="진행 중"
        value={data?.inProgress ?? "-"}
        tone="blue"
      />
      <Card
        icon={<CheckCircle2 size={16} />}
        label="완료"
        value={data?.completed ?? "-"}
        tone="emerald"
      />
      <Card
        icon={<XCircle size={16} />}
        label="실패"
        value={data?.failed ?? "-"}
        tone="rose"
      />
      <Card
        icon={<TrendingUp size={16} />}
        label="평균 편차"
        value={
          data?.avgDeviationPct != null
            ? `${data.avgDeviationPct.toFixed(1)}%`
            : "-"
        }
        sub={
          data?.maxDeviationPct != null
            ? `최대 ${data.maxDeviationPct.toFixed(1)}%`
            : undefined
        }
        tone="amber"
      />
    </section>
  );
}

const TONES = {
  slate: "border-slate-200 text-slate-700",
  blue: "border-blue-200 text-blue-700",
  emerald: "border-emerald-200 text-emerald-700",
  rose: "border-rose-200 text-rose-700",
  amber: "border-amber-200 text-amber-700",
};

function Card({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div
      className={`bg-white rounded-lg border px-4 py-3 ${TONES[tone]}`}
    >
      <div className="flex items-center gap-1.5 text-xs">
        {icon}
        <span className="text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1 text-slate-800">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
