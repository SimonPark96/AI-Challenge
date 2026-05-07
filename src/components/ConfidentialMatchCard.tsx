"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRequestStore } from "@/lib/stores/request-store";

interface MatchRow {
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unitPrice: number | null;
  confId: number | null;
  confName: string | null;
  confSpec: string | null;
  confUnit: string | null;
  confTotalCost: number | null;
  confidence: number;
  deviationPct: number | null;
}

function fmt(n: number | null): string {
  return n != null ? n.toLocaleString() + "원" : "-";
}

function DevBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400">-</span>;
  const abs = Math.abs(pct);
  const sign = pct > 0 ? "+" : "";
  if (abs <= 5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-700 font-mono font-semibold">
        <Minus size={12} />
        {sign}{pct.toFixed(1)}%
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-600 font-mono font-semibold">
        <TrendingUp size={12} />
        {sign}{pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-blue-600 font-mono font-semibold">
      <TrendingDown size={12} />
      {pct.toFixed(1)}%
    </span>
  );
}

function ConfBadge({ conf }: { conf: number }) {
  const pct = Math.round(conf * 100);
  const cls =
    pct >= 70
      ? "bg-emerald-100 text-emerald-700"
      : pct >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold tabular-nums ${cls}`}>
      {pct}%
    </span>
  );
}

export function ConfidentialMatchCard() {
  const status = useRequestStore((s) => s.status);
  const items = useRequestStore((s) => s.form.items);

  const [matchStatus, setMatchStatus] = useState<"idle" | "loading" | "done" | "empty" | "noDb" | "error">("idle");
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    if (status !== "extracted") {
      setMatchStatus("idle");
      setMatches([]);
      setError(null);
      lastKeyRef.current = "";
      return;
    }

    const validItems = items.filter((it) => it.itemName.trim() !== "");
    if (validItems.length === 0) {
      setMatchStatus("empty");
      return;
    }

    // 항목이 달라질 때만 재실행
    const key = validItems.map((it) => `${it.itemName}|${it.spec}|${it.unitPrice}`).join(";;");
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setMatchStatus("loading");
    setError(null);

    fetch("/api/confidential/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: validItems.map((it, i) => ({
          rowIndex: i,
          itemName: it.itemName,
          spec: it.spec || null,
          unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
        })),
      }),
      signal: ac.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const rows: MatchRow[] = data.matches ?? [];
        const hasAny = rows.some((r) => r.confId !== null);
        if (!hasAny) {
          setMatchStatus("noDb");
          setMatches([]);
        } else {
          setMatches(rows);
          setMatchStatus("done");
        }
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setMatchStatus("error");
      });

    return () => {
      abortRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, items]);

  if (matchStatus === "idle") return null;

  return (
    <section className="bg-white rounded-lg border border-rose-200 p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Lock size={18} className="text-rose-500" />
          기밀 단가 자동 매칭
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          업로드된 협력사 견적 항목을 사내 기밀 단가와 항목별로 비교합니다.
          편차가 양수(+)이면 협력사 단가가 기밀 단가보다 높은 것입니다.
        </p>
      </div>

      {matchStatus === "loading" && (
        <div className="text-xs text-rose-600 border border-rose-200 bg-rose-50/40 rounded p-3 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          기밀 단가와 매칭 중...
        </div>
      )}

      {matchStatus === "noDb" && (
        <div className="text-xs text-slate-500 border border-slate-200 bg-slate-50 rounded p-3 inline-flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          기밀 단가 DB 에 등록된 데이터가 없습니다. DB 관리 페이지에서 기밀 단가를 먼저 등록해주세요.
        </div>
      )}

      {matchStatus === "error" && (
        <div className="text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded p-3 inline-flex items-center gap-2">
          <AlertTriangle size={14} />
          매칭 실패: {error}
        </div>
      )}

      {matchStatus === "done" && matches.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-rose-50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium text-slate-600 text-xs">협력사 항목명</th>
                <th className="text-left p-2 font-medium text-slate-600 text-xs">규격</th>
                <th className="text-right p-2 font-medium text-slate-600 text-xs">협력사 단가</th>
                <th className="text-left p-2 font-medium text-rose-600 text-xs">기밀 매칭 항목</th>
                <th className="text-right p-2 font-medium text-rose-600 text-xs">기밀 단가계</th>
                <th className="text-right p-2 font-medium text-slate-600 text-xs">편차</th>
                <th className="text-center p-2 font-medium text-slate-600 text-xs">신뢰도</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((row) => (
                <tr key={row.rowIndex} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-2 text-slate-800 font-medium max-w-[180px] truncate" title={row.itemName}>
                    {row.itemName}
                  </td>
                  <td className="p-2 text-slate-500 text-xs max-w-[120px] truncate" title={row.spec ?? ""}>
                    {row.spec || "-"}
                  </td>
                  <td className="p-2 text-right font-mono text-slate-700">
                    {fmt(row.unitPrice)}
                  </td>
                  {row.confId !== null ? (
                    <>
                      <td className="p-2 text-rose-700 text-xs max-w-[180px]">
                        <div className="truncate font-medium" title={row.confName ?? ""}>{row.confName}</div>
                        {row.confSpec && (
                          <div className="text-rose-400 truncate" title={row.confSpec}>{row.confSpec}</div>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono font-semibold text-rose-700">
                        {fmt(row.confTotalCost)}
                      </td>
                      <td className="p-2 text-right">
                        <DevBadge pct={row.deviationPct} />
                      </td>
                      <td className="p-2 text-center">
                        <ConfBadge conf={row.confidence} />
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="p-2 text-xs text-slate-400">매칭 없음</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 px-1">
            <span className="inline-flex items-center gap-1">
              <TrendingUp size={11} className="text-rose-500" />
              협력사 단가 &gt; 기밀 단가
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingDown size={11} className="text-blue-500" />
              협력사 단가 &lt; 기밀 단가
            </span>
            <span className="inline-flex items-center gap-1">
              <Minus size={11} className="text-emerald-500" />
              편차 5% 이내
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
