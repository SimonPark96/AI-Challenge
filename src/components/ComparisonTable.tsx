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
  matchedPrice: {
    itemName: string;
    spec: string | null;
    source: string;
    region: string | null;
  } | null;
}

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() : "-";
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

export function ComparisonTable({ items }: { items: ItemRow[] }) {
  const matchedCount = items.filter((it) => it.matchedPrice != null).length;
  const overCount = items.filter(
    (it) => it.deviationPct != null && it.deviationPct > 10
  ).length;
  const underCount = items.filter(
    (it) => it.deviationPct != null && it.deviationPct < -10
  ).length;

  return (
    <section className="bg-white rounded-lg border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            단가 비교 결과
          </h2>
          <div className="text-xs text-slate-500 mt-1">
            총 {items.length}건 · 매칭 {matchedCount}건 · 시장 대비 비쌈{" "}
            <span className="text-rose-600 font-medium">{overCount}</span> ·
            저렴{" "}
            <span className="text-blue-600 font-medium">{underCount}</span>
          </div>
        </div>
      </div>

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
              <th className="text-left px-3 py-2.5 font-medium">매칭 자재</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-3 py-2.5 text-xs font-mono text-slate-400">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-slate-800">{it.itemName}</div>
                  {it.spec && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      {it.spec}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {it.unit ?? "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                  {fmt(it.quantity)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-800">
                  {fmt(it.unitPrice)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                  {fmt(it.marketPrice)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-mono ${devColor(
                    it.deviationPct
                  )}`}
                >
                  {it.deviationPct != null
                    ? `${it.deviationPct > 0 ? "+" : ""}${it.deviationPct.toFixed(
                        1
                      )}%`
                    : "-"}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-xs ${confColor(
                    it.matchedConfidence
                  )}`}
                >
                  {it.matchedConfidence != null
                    ? `${(it.matchedConfidence * 100).toFixed(0)}%`
                    : "-"}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {it.matchedPrice ? (
                    <>
                      <div className="text-slate-700">
                        {it.matchedPrice.itemName}
                        {it.matchedPrice.spec
                          ? ` · ${it.matchedPrice.spec}`
                          : ""}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {it.matchedPrice.source}
                        {it.marketRegion ? ` · ${it.marketRegion}` : ""}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-400">매칭 없음</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-12 text-center text-slate-400 text-sm"
                >
                  분석된 라인 아이템이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
