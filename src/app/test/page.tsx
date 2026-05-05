"use client";

import { useCallback, useEffect, useState } from "react";

type Source = "kpi" | "kprc" | "cmpi";

interface RunSummary {
  id: number;
  source: string;
  keyword: string;
  sourceUrl: string | null;
  fetchedAt: string;
  createdAt: string;
  _count: { prices: number };
}

interface PriceRow {
  id: number;
  scrapeRunId: number;
  materialId: number | null;
  source: string;
  itemName: string;
  spec: string | null;
  unit: string | null;
  region: string | null;
  price: number | null;
  currency: string;
  extras: unknown;
  fetchedAt: string;
  hasEmbedding: boolean;
  embeddingDim: number;
}

interface QuoteSummary {
  id: number;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: string;
  errorMsg: string | null;
  _count: { items: number };
}

interface QuoteItem {
  id: number;
  rowIndex: number;
  itemName: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  matchedPriceId: number | null;
  matchedConfidence: number | null;
  marketPrice: number | null;
  marketRegion: string | null;
  deviationPct: number | null;
  matchedPrice?: {
    id: number;
    itemName: string;
    spec: string | null;
    source: string;
  } | null;
}

const SOURCE_LABELS: Record<Source, string> = {
  kpi: "kpi (한국물가정보)",
  kprc: "kprc (한국물가협회)",
  cmpi: "cmpi (대한건설협회)",
};

export default function TestPage() {
  return (
    <main className="p-6 max-w-6xl mx-auto space-y-8 font-sans">
      <header>
        <h1 className="text-2xl font-bold">스크래퍼 + 견적서 검증 테스트</h1>
        <p className="text-sm text-gray-500 mt-1">
          POST /api/scrape/[source] · GET /api/runs · GET /api/prices · POST
          /api/quote/upload · GET /api/quote/[id]
        </p>
      </header>

      <ScrapeSection />
      <RunsSection />
      <PricesSection />
      <QuoteSection />
    </main>
  );
}

function ScrapeSection() {
  const [source, setSource] = useState<Source>("cmpi");
  const [keyword, setKeyword] = useState("고장력철근");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/scrape/${source}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      setResult({ status: res.status, ...data });
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border rounded p-4 space-y-3">
      <h2 className="text-lg font-semibold">1. 스크래핑 실행</h2>
      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
          className="border rounded px-2 py-1"
        >
          {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="검색어"
          className="border rounded px-2 py-1 flex-1 min-w-[200px]"
        />
        <button
          onClick={run}
          disabled={loading || !keyword.trim()}
          className="bg-blue-600 text-white px-4 py-1 rounded disabled:opacity-50"
        >
          {loading ? "실행 중..." : "Run"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        실제 스크래퍼를 호출하므로 30초~수분 소요됩니다. headless 모드 안정성에
        따라 실패할 수 있습니다.
      </p>
      {result !== null && (
        <pre className="bg-gray-50 border p-2 rounded text-xs overflow-auto max-h-64">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
  );
}

function RunsSection() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (filterSource) params.set("source", filterSource);
      const res = await fetch(`/api/runs?${params.toString()}`);
      const data = await res.json();
      setRuns(data.runs ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterSource]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function resetDb() {
    if (
      !confirm(
        "정말 ScrapeRun + PriceHistory 전체 삭제? (Material/Quotation 은 유지됩니다)"
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      alert(
        `삭제 완료: ScrapeRun ${data.deletedScrapeRuns}개 (PriceHistory cascade)`
      );
      await refresh();
    } catch (err) {
      alert(`실패: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border rounded p-4 space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-semibold">2. ScrapeRun 목록</h2>
        <div className="flex gap-2 items-center">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">전체 소스</option>
            <option value="kpi">kpi</option>
            <option value="kprc">kprc</option>
            <option value="cmpi">cmpi</option>
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="border px-3 py-1 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "..." : "Refresh"}
          </button>
          <button
            onClick={resetDb}
            disabled={loading}
            className="border border-red-300 text-red-700 px-3 py-1 rounded text-sm hover:bg-red-50 disabled:opacity-50"
          >
            DB Reset
          </button>
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">id</th>
              <th className="text-left p-2">source</th>
              <th className="text-left p-2">keyword</th>
              <th className="text-left p-2">fetchedAt</th>
              <th className="text-right p-2">prices</th>
              <th className="text-left p-2">sourceUrl</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-mono">{r.id}</td>
                <td className="p-2">{r.source}</td>
                <td className="p-2">{r.keyword}</td>
                <td className="p-2">
                  {new Date(r.fetchedAt).toLocaleString()}
                </td>
                <td className="p-2 text-right font-mono">
                  {r._count.prices}
                </td>
                <td className="p-2 text-xs text-gray-500 truncate max-w-xs">
                  {r.sourceUrl ?? "-"}
                </td>
              </tr>
            ))}
            {runs.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={6}
                  className="p-3 text-gray-500 text-center"
                >
                  데이터 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuoteSection() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<unknown>(null);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [items, setItems] = useState<QuoteItem[] | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);

  const refreshQuotes = useCallback(async () => {
    const res = await fetch("/api/quote?limit=20");
    const data = await res.json();
    setQuotes(data.quotes ?? []);
  }, []);

  useEffect(() => {
    refreshQuotes();
  }, [refreshQuotes]);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/quote/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setUploadResult({ status: res.status, ...data });
      await refreshQuotes();
      if (data.quotationId) {
        setSelectedId(data.quotationId);
        await loadItems(data.quotationId);
      }
    } catch (err) {
      setUploadResult({ error: String(err) });
    } finally {
      setUploading(false);
    }
  }

  async function loadItems(id: number) {
    setLoadingItems(true);
    setItems(null);
    try {
      const res = await fetch(`/api/quote/${id}`);
      const data = await res.json();
      setItems(data.quote?.items ?? []);
    } finally {
      setLoadingItems(false);
    }
  }

  return (
    <section className="border rounded p-4 space-y-3">
      <h2 className="text-lg font-semibold">4. 견적서 업로드 + AI 파싱</h2>
      <p className="text-xs text-gray-500">
        OPENAI_API_KEY 필요. PDF/Excel 파일 업로드 → OpenAI Assistants API
        파싱 → DB(PriceHistory)와 매칭 + 단가 편차 계산.
      </p>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="border rounded px-2 py-1 flex-1 min-w-[200px]"
        />
        <button
          onClick={upload}
          disabled={!file || uploading}
          className="bg-blue-600 text-white px-4 py-1 rounded disabled:opacity-50"
        >
          {uploading ? "처리 중... (수십 초)" : "Upload + Parse"}
        </button>
      </div>
      {uploadResult !== null && (
        <pre className="bg-gray-50 border p-2 rounded text-xs overflow-auto max-h-48">
          {JSON.stringify(uploadResult, null, 2)}
        </pre>
      )}

      <div className="border-t pt-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-sm">최근 Quotation</h3>
          <button
            onClick={refreshQuotes}
            className="border px-2 py-0.5 rounded text-xs hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">id</th>
                <th className="text-left p-2">fileName</th>
                <th className="text-left p-2">status</th>
                <th className="text-right p-2">items</th>
                <th className="text-left p-2">uploadedAt</th>
                <th className="text-left p-2"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono">{q.id}</td>
                  <td className="p-2">{q.fileName}</td>
                  <td className="p-2">
                    <span
                      className={
                        q.status === "compared"
                          ? "text-green-700"
                          : q.status === "failed"
                            ? "text-red-700"
                            : "text-gray-700"
                      }
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono">
                    {q._count.items}
                  </td>
                  <td className="p-2 text-xs">
                    {new Date(q.uploadedAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => {
                        setSelectedId(q.id);
                        loadItems(q.id);
                      }}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      열기
                    </button>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-3 text-gray-500 text-center"
                  >
                    업로드된 견적서 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId !== null && (
        <div className="border-t pt-3 space-y-2">
          <h3 className="font-semibold text-sm">
            Quotation #{selectedId} 아이템
            {loadingItems && <span className="text-gray-400 ml-2">로딩...</span>}
          </h3>
          {items && (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">itemName</th>
                    <th className="text-left p-2">spec</th>
                    <th className="text-right p-2">qty</th>
                    <th className="text-right p-2">단가</th>
                    <th className="text-right p-2">시장가</th>
                    <th className="text-right p-2">편차%</th>
                    <th className="text-right p-2">conf</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-mono">{it.rowIndex}</td>
                      <td className="p-2">{it.itemName}</td>
                      <td className="p-2 text-xs">{it.spec ?? "-"}</td>
                      <td className="p-2 text-right font-mono">
                        {it.quantity ?? "-"}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {it.unitPrice?.toLocaleString() ?? "-"}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {it.marketPrice?.toLocaleString() ?? "-"}
                      </td>
                      <td
                        className={`p-2 text-right font-mono ${
                          it.deviationPct == null
                            ? ""
                            : it.deviationPct > 10
                              ? "text-red-600"
                              : it.deviationPct < -10
                                ? "text-blue-600"
                                : "text-gray-600"
                        }`}
                      >
                        {it.deviationPct != null
                          ? `${it.deviationPct.toFixed(1)}%`
                          : "-"}
                      </td>
                      <td className="p-2 text-right text-xs text-gray-500">
                        {it.matchedConfidence != null
                          ? it.matchedConfidence.toFixed(2)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-3 text-gray-500 text-center"
                      >
                        아이템 없음
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PricesSection() {
  const [source, setSource] = useState("");
  const [itemName, setItemName] = useState("");
  const [runId, setRunId] = useState("");
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  async function search() {
    setLoading(true);
    setCount(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (source) params.set("source", source);
      if (itemName.trim()) params.set("itemName", itemName.trim());
      if (runId.trim()) params.set("runId", runId.trim());
      const res = await fetch(`/api/prices?${params.toString()}`);
      const data = await res.json();
      setPrices(data.prices ?? []);
      setCount(data.count ?? 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border rounded p-4 space-y-3">
      <h2 className="text-lg font-semibold">3. PriceHistory 조회</h2>
      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">전체 소스</option>
          <option value="kpi">kpi</option>
          <option value="kprc">kprc</option>
          <option value="cmpi">cmpi</option>
        </select>
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="품명 (부분일치)"
          className="border rounded px-2 py-1"
        />
        <input
          value={runId}
          onChange={(e) => setRunId(e.target.value)}
          placeholder="runId"
          type="number"
          className="border rounded px-2 py-1 w-24"
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-1 rounded disabled:opacity-50"
        >
          {loading ? "..." : "조회"}
        </button>
        {count !== null && (
          <span className="text-sm text-gray-500">{count}건</span>
        )}
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">id</th>
              <th className="text-left p-2">runId</th>
              <th className="text-left p-2">source</th>
              <th className="text-left p-2">itemName</th>
              <th className="text-left p-2">spec</th>
              <th className="text-left p-2">unit</th>
              <th className="text-left p-2">region</th>
              <th className="text-right p-2">price</th>
              <th className="text-center p-2">embed</th>
              <th className="text-left p-2">fetchedAt</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-2 font-mono">{p.id}</td>
                <td className="p-2 font-mono">{p.scrapeRunId}</td>
                <td className="p-2">{p.source}</td>
                <td className="p-2">{p.itemName}</td>
                <td className="p-2">{p.spec ?? "-"}</td>
                <td className="p-2">{p.unit ?? "-"}</td>
                <td className="p-2">{p.region ?? "-"}</td>
                <td className="p-2 text-right font-mono">
                  {p.price !== null ? p.price.toLocaleString() : "-"}
                </td>
                <td className="p-2 text-center text-xs">
                  {p.hasEmbedding ? (
                    <span className="text-green-700">✓ {p.embeddingDim}d</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="p-2 text-xs text-gray-500">
                  {new Date(p.fetchedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {prices.length === 0 && !loading && count !== null && (
              <tr>
                <td
                  colSpan={10}
                  className="p-3 text-gray-500 text-center"
                >
                  결과 없음
                </td>
              </tr>
            )}
            {count === null && (
              <tr>
                <td
                  colSpan={10}
                  className="p-3 text-gray-400 text-center"
                >
                  조회 버튼을 누르세요
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
