"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";

interface ItemRow {
  id: number;
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  matchedConfidence: number | null;
  marketPrice: number | null;
  marketRegion: string | null;
  deviationPct: number | null;
  matchedSource: "price" | "wage" | null;
  matchedPrice: {
    itemName: string;
    spec: string | null;
    source: string;
    region: string | null;
  } | null;
  matchedWage: {
    jobName: string;
    cateCd: string;
    source: string;
    unit: string | null;
    basis: string | null;
  } | null;
}

/**
 * 노임 source 문자열("kpi-wage") 을 화면 표시용 출처명으로 변환.
 * 두 카테고리 모두 KPI 도메인이라 일단 "KPI" 로 통일.
 */
function wageSourceLabel(s: string | undefined | null): string {
  if (!s) return "-";
  if (s.toLowerCase().startsWith("kpi")) return "KPI";
  return s.toUpperCase();
}

const WAGE_CATE_LABELS: Record<string, string> = {
  "701111": "공사부문",
  "701115": "기타직종",
};

interface Draft {
  itemName: string;
  spec: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  marketPrice: string;
  marketRegion: string;
  matchedConfidencePct: string; // 0..100 표시. 저장 시 /100 으로 변환
}

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() : "-";
}

/**
 * 시장단가가 협력사 단가 대비 얼마나 차이나는지 (협력사 = 기준).
 * dev > 0 → 시장이 협력사보다 비쌈 (협력사가 시장 대비 저렴)
 * dev < 0 → 시장이 협력사보다 저렴 (협력사가 시장 대비 비쌈)
 *
 * 저장된 it.deviationPct 는 이전 컨벤션((unit-market)/market) 기준이라 표시에 사용 X.
 * 항상 raw unitPrice/marketPrice 로 즉석 계산.
 */
function computeDev(
  unit: number | null,
  market: number | null
): number | null {
  if (unit == null || market == null || unit === 0) return null;
  return ((market - unit) / unit) * 100;
}

function devColor(dev: number | null): string {
  if (dev == null) return "text-slate-400";
  if (dev > 10) return "text-rose-600";
  if (dev < -10) return "text-blue-600";
  return "text-emerald-600";
}

function confColor(conf: number | null): string {
  if (conf == null) return "text-slate-400";
  const pct = conf * 100;
  if (pct >= 70) return "text-emerald-600";
  if (pct >= 40) return "text-amber-600";
  return "text-rose-600";
}

function toDraft(it: ItemRow): Draft {
  return {
    itemName: it.itemName,
    spec: it.spec ?? "",
    unit: it.unit ?? "",
    quantity: it.quantity != null ? String(it.quantity) : "",
    unitPrice: it.unitPrice != null ? String(it.unitPrice) : "",
    marketPrice: it.marketPrice != null ? String(it.marketPrice) : "",
    marketRegion: it.marketRegion ?? "",
    matchedConfidencePct:
      it.matchedConfidence != null
        ? String(Math.round(it.matchedConfidence * 100))
        : "",
  };
}

function parseNumOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  // 콤마 허용
  const cleaned = t.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function buildPayload(draft: Draft): Record<string, unknown> {
  const conf = parseNumOrNull(draft.matchedConfidencePct);
  return {
    itemName: draft.itemName,
    spec: draft.spec.trim() === "" ? null : draft.spec,
    unit: draft.unit.trim() === "" ? null : draft.unit,
    quantity: parseNumOrNull(draft.quantity),
    unitPrice: parseNumOrNull(draft.unitPrice),
    marketPrice: parseNumOrNull(draft.marketPrice),
    marketRegion: draft.marketRegion.trim() === "" ? null : draft.marketRegion,
    matchedConfidence:
      conf == null ? null : Math.max(0, Math.min(100, conf)) / 100,
  };
}

export function ComparisonTable({
  quotationId,
  items,
}: {
  quotationId: number;
  items: ItemRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(items.map((it) => [it.id, toDraft(it)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const matchedCount = items.filter((it) => it.matchedPrice != null).length;
  const overCount = items.filter((it) => {
    const d = computeDev(it.unitPrice, it.marketPrice);
    return d != null && d > 10;
  }).length;
  const underCount = items.filter((it) => {
    const d = computeDev(it.unitPrice, it.marketPrice);
    return d != null && d < -10;
  }).length;

  // 어떤 row 들이 dirty 한지 — 변경 안 된 row 는 PATCH 안 보냄
  const dirtyIds = useMemo(() => {
    const out: number[] = [];
    for (const it of items) {
      const d = drafts[it.id];
      if (!d) continue;
      const orig = toDraft(it);
      if (
        d.itemName !== orig.itemName ||
        d.spec !== orig.spec ||
        d.unit !== orig.unit ||
        d.quantity !== orig.quantity ||
        d.unitPrice !== orig.unitPrice ||
        d.marketPrice !== orig.marketPrice ||
        d.marketRegion !== orig.marketRegion ||
        d.matchedConfidencePct !== orig.matchedConfidencePct
      ) {
        out.push(it.id);
      }
    }
    return out;
  }, [drafts, items]);

  function startEditing() {
    // items 가 갱신될 수 있으니 매번 시작할 때 draft 초기화
    setDrafts(Object.fromEntries(items.map((it) => [it.id, toDraft(it)])));
    setError(null);
    setSavedAt(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDrafts(Object.fromEntries(items.map((it) => [it.id, toDraft(it)])));
    setError(null);
  }

  function updateDraft(id: number, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  async function save() {
    if (dirtyIds.length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        dirtyIds.map((id) =>
          fetch(`/api/quote/${quotationId}/item/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload(drafts[id])),
          }).then(async (r) => {
            if (!r.ok) {
              const d = await r.json().catch(() => ({}));
              throw new Error(d.error ?? `HTTP ${r.status}`);
            }
            return r.json();
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const msg = (failed[0] as PromiseRejectedResult).reason;
        throw new Error(
          `${failed.length}/${results.length} 행 저장 실패: ${
            msg instanceof Error ? msg.message : String(msg)
          }`
        );
      }
      setSavedAt(Date.now());
      setEditing(false);
      router.refresh(); // 서버 컴포넌트 재렌더링 — 새 items 로 prop 갱신
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            세부 단가 비교 결과
          </h2>
          <div className="text-xs text-slate-500 mt-1">
            총 {items.length}건 · 매칭 {matchedCount}건 · 협력사보다 비쌈{" "}
            <span className="text-rose-600 font-medium">{overCount}</span> ·
            저렴 <span className="text-blue-600 font-medium">{underCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && !editing && (
            <span className="text-xs text-emerald-600">저장됨</span>
          )}
          {!editing ? (
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1 text-sm border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded"
            >
              <Pencil size={14} /> 편집 모드
            </button>
          ) : (
            <>
              <span className="text-xs text-slate-500">
                변경된 행: {dirtyIds.length}건
              </span>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="inline-flex items-center gap-1 text-sm border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded disabled:opacity-50"
              >
                <X size={14} /> 취소
              </button>
              <button
                onClick={save}
                disabled={saving || dirtyIds.length === 0}
                className="inline-flex items-center gap-1 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "저장 중..." : "저장"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium w-10">#</th>
              <th className="text-left px-3 py-2.5 font-medium">품명 / 규격</th>
              <th className="text-left px-3 py-2.5 font-medium w-20">단위</th>
              <th className="text-right px-3 py-2.5 font-medium w-20">수량</th>
              <th className="text-right px-3 py-2.5 font-medium w-28">
                협력사 단가
              </th>
              <th className="text-right px-3 py-2.5 font-medium w-28">
                시장 단가
              </th>
              <th className="text-right px-3 py-2.5 font-medium w-20">편차</th>
              <th className="text-right px-3 py-2.5 font-medium w-20">
                신뢰도
              </th>
              <th className="text-left px-3 py-2.5 font-medium w-20">출처</th>
              <th className="text-left px-3 py-2.5 font-medium">매칭 자재</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const d = drafts[it.id] ?? toDraft(it);
              return (
                <tr key={it.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-xs font-mono text-slate-400">
                    {String(i + 1).padStart(2, "0")}
                  </td>

                  {/* 품명 / 규격 */}
                  <td className="px-3 py-2.5">
                    {editing ? (
                      <div className="space-y-1">
                        <Input
                          value={d.itemName}
                          onChange={(v) => updateDraft(it.id, { itemName: v })}
                          placeholder="품명"
                        />
                        <Input
                          value={d.spec}
                          onChange={(v) => updateDraft(it.id, { spec: v })}
                          placeholder="규격"
                          className="text-xs"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-slate-800">{it.itemName}</div>
                        {it.spec && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {it.spec}
                          </div>
                        )}
                      </>
                    )}
                  </td>

                  {/* 단위 */}
                  <td className="px-3 py-2.5 text-slate-600">
                    {editing ? (
                      <Input
                        value={d.unit}
                        onChange={(v) => updateDraft(it.id, { unit: v })}
                        placeholder="-"
                      />
                    ) : (
                      it.unit ?? "-"
                    )}
                  </td>

                  {/* 수량 */}
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {editing ? (
                      <NumberInput
                        value={d.quantity}
                        onChange={(v) => updateDraft(it.id, { quantity: v })}
                      />
                    ) : (
                      fmt(it.quantity)
                    )}
                  </td>

                  {/* 협력사 단가 */}
                  <td className="px-3 py-2.5 text-right font-mono text-slate-800">
                    {editing ? (
                      <NumberInput
                        value={d.unitPrice}
                        onChange={(v) => updateDraft(it.id, { unitPrice: v })}
                      />
                    ) : (
                      fmt(it.unitPrice)
                    )}
                  </td>

                  {/* 시장 단가 — 매칭이 없으면 marketPrice 가 null 이라 자동 "-" */}
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {editing ? (
                      <NumberInput
                        value={d.marketPrice}
                        onChange={(v) => updateDraft(it.id, { marketPrice: v })}
                      />
                    ) : (
                      fmt(it.marketPrice)
                    )}
                  </td>

                  {/* 편차 — 시장이 협력사 단가 대비 얼마나 비싸냐(+) / 싸냐(-). 편집 중엔 draft 기반 preview */}
                  <td
                    className={`px-3 py-2.5 text-right font-mono ${devColor(
                      editing
                        ? previewDeviation(d)
                        : computeDev(it.unitPrice, it.marketPrice)
                    )}`}
                  >
                    {(() => {
                      const dev = editing
                        ? previewDeviation(d)
                        : computeDev(it.unitPrice, it.marketPrice);
                      return dev != null
                        ? `${dev > 0 ? "+" : ""}${dev.toFixed(1)}%`
                        : "-";
                    })()}
                  </td>

                  {/* 신뢰도 */}
                  <td
                    className={`px-3 py-2.5 text-right text-xs ${confColor(
                      editing ? draftConfFraction(d) : it.matchedConfidence
                    )}`}
                  >
                    {editing ? (
                      <NumberInput
                        value={d.matchedConfidencePct}
                        onChange={(v) =>
                          updateDraft(it.id, { matchedConfidencePct: v })
                        }
                        suffix="%"
                      />
                    ) : it.matchedConfidence != null ? (
                      `${(it.matchedConfidence * 100).toFixed(0)}%`
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* 출처 — 읽기 전용. 자재면 source(KPI/KPRC/CMPI), 노임이면 source + 노임 칩 */}
                  <td className="px-3 py-2.5 text-xs">
                    {it.matchedSource === "wage" && it.matchedWage ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-slate-700 uppercase">
                          {wageSourceLabel(it.matchedWage.source)}
                        </span>
                        <span className="inline-block text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-fit">
                          노임
                        </span>
                      </div>
                    ) : it.matchedPrice?.source ? (
                      <span className="font-mono text-slate-500 uppercase">
                        {it.matchedPrice.source}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* 매칭 자재/직종 — itemName / spec / 지역(편집 가능) */}
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {(() => {
                      if (it.matchedSource === "wage" && it.matchedWage) {
                        return (
                          <>
                            <div className="text-slate-700">
                              {it.matchedWage.jobName}
                              {it.matchedWage.unit
                                ? ` · /${it.matchedWage.unit}`
                                : ""}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {WAGE_CATE_LABELS[it.matchedWage.cateCd] ??
                                it.matchedWage.cateCd}
                              {it.matchedWage.basis
                                ? ` · ${it.matchedWage.basis}`
                                : ""}
                            </div>
                          </>
                        );
                      } else if (it.matchedPrice) {
                        return (
                          <>
                            <div className="text-slate-700">
                              {it.matchedPrice.itemName}
                              {it.matchedPrice.spec
                                ? ` · ${it.matchedPrice.spec}`
                                : ""}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {editing ? (
                                <Input
                                  value={d.marketRegion}
                                  onChange={(v) =>
                                    updateDraft(it.id, { marketRegion: v })
                                  }
                                  placeholder="지역"
                                  className="inline-block w-20 text-[11px]"
                                />
                              ) : it.marketRegion ? (
                                it.marketRegion
                              ) : (
                                ""
                              )}
                            </div>
                          </>
                        );
                      } else {
                        return (
                          <>
                            <span className="text-slate-400">
                              매칭 없음(직접 입력)
                            </span>
                            {editing && (
                              <Input
                                value={d.marketRegion}
                                onChange={(v) =>
                                  updateDraft(it.id, { marketRegion: v })
                                }
                                placeholder="지역"
                                className="mt-1 w-24 text-[11px]"
                              />
                            )}
                          </>
                        );
                      }
                    })()}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-12 text-center text-slate-400 text-sm"
                >
                  분석된 라인 아이템이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {items.length > 0 && (() => {
            const partnerSum = items.reduce((a, it) => a + (it.unitPrice ?? 0) * (it.quantity ?? 1), 0);
            const marketSum  = items.reduce((a, it) => it.marketPrice != null ? a + it.marketPrice * (it.quantity ?? 1) : a, 0);
            const hasMarket  = items.some((it) => it.marketPrice != null);
            return (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-slate-600">합계</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                    {partnerSum > 0 ? partnerSum.toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-700">
                    {hasMarket && marketSum > 0 ? marketSum.toLocaleString() : "-"}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </section>
  );
}

function previewDeviation(d: Draft): number | null {
  const u = parseNumOrNull(d.unitPrice);
  const m = parseNumOrNull(d.marketPrice);
  return computeDev(u, m);
}

function draftConfFraction(d: Draft): number | null {
  const v = parseNumOrNull(d.matchedConfidencePct);
  if (v == null) return null;
  return Math.max(0, Math.min(100, v)) / 100;
}

function Input({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 ${className}`}
    />
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="w-24 border border-slate-300 rounded px-2 py-1 text-sm text-right font-mono bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
    </div>
  );
}
