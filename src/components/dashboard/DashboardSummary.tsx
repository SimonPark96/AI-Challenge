"use client";

import { useEffect, useState } from "react";
import { ListChecks, Loader2, CheckCircle2, XCircle } from "lucide-react";

export type DashboardFilter = "all" | "inProgress" | "completed" | "failed";

interface Summary {
  total: number;
  inProgress: number;
  completed: number;
  failed: number;
  avgDeviationPct: number | null;
  maxDeviationPct: number | null;
  lastUploadedAt: string | null;
}

async function fetchSummary(): Promise<Summary | null> {
  try {
    const res = await fetch("/api/dashboard/summary");
    if (!res.ok) return null;
    return (await res.json()) as Summary;
  } catch {
    return null;
  }
}

export function DashboardSummary({
  filter,
  onFilterChange,
}: {
  filter: DashboardFilter;
  onFilterChange: (f: DashboardFilter) => void;
}) {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSummary().then((d) => {
      if (cancelled) return;
      if (d) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card
        icon={<ListChecks size={16} />}
        label="전체 분석"
        value={data?.total ?? "-"}
        tone="slate"
        active={filter === "all"}
        onClick={() => onFilterChange("all")}
      />
      <Card
        icon={<Loader2 size={16} />}
        label="진행 중"
        value={data?.inProgress ?? "-"}
        tone="blue"
        active={filter === "inProgress"}
        onClick={() => onFilterChange("inProgress")}
      />
      <Card
        icon={<CheckCircle2 size={16} />}
        label="완료"
        value={data?.completed ?? "-"}
        tone="emerald"
        active={filter === "completed"}
        onClick={() => onFilterChange("completed")}
      />
      <Card
        icon={<XCircle size={16} />}
        label="실패"
        value={data?.failed ?? "-"}
        tone="rose"
        active={filter === "failed"}
        onClick={() => onFilterChange("failed")}
      />
    </section>
  );
}

const TONES_INACTIVE = {
  slate: "border-slate-200 text-slate-700 hover:border-slate-300",
  blue: "border-blue-200 text-blue-700 hover:border-blue-300",
  emerald: "border-emerald-200 text-emerald-700 hover:border-emerald-300",
  rose: "border-rose-200 text-rose-700 hover:border-rose-300",
};

const TONES_ACTIVE = {
  slate: "border-slate-500 ring-2 ring-slate-200 text-slate-800",
  blue: "border-blue-500 ring-2 ring-blue-200 text-blue-800",
  emerald: "border-emerald-500 ring-2 ring-emerald-200 text-emerald-800",
  rose: "border-rose-500 ring-2 ring-rose-200 text-rose-800",
};

function Card({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: keyof typeof TONES_INACTIVE;
  active: boolean;
  onClick: () => void;
}) {
  const toneCls = active ? TONES_ACTIVE[tone] : TONES_INACTIVE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`bg-white rounded-lg border px-4 py-3 text-left transition cursor-pointer ${toneCls}`}
    >
      <div className="flex items-center gap-1.5 text-xs">
        {icon}
        <span className="text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1 text-slate-800">{value}</div>
    </button>
  );
}
