"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Lock, Upload } from "lucide-react";

const ACCEPT = ".xlsx,.xls,.csv";

export function ConfidentialImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/confidential/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setResult({ status: res.status, ...data });
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setUploading(false);
    }
  }

  const resultData = result as Record<string, unknown> | null;
  const isOk = resultData && (resultData.status as number) < 300;

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
        <Lock size={18} className="text-rose-500" />
        사내 DB 단가 등록
      </h2>
      <p className="text-xs text-slate-500">
        사내 DB 단가 파일을 업로드합니다.{" "}
        <span className="font-medium text-slate-700">
          명칭 / 규격 / 단위 / 재료비 / 노무비 / 경비 / 단가계
        </span>{" "}
        컬럼이 포함된 엑셀 파일이어야 합니다.
      </p>

      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        onDragOver={(e) => e.preventDefault()}
        className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition ${
          file
            ? "border-rose-300 bg-rose-50/40"
            : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet className="text-rose-500" size={28} />
            <div className="text-sm text-slate-800">{file.name}</div>
            <div className="text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
        ) : (
          <>
            <Upload className="text-slate-400 mx-auto mb-2" size={28} />
            <div className="text-sm text-slate-500">
              파일을 드래그하거나 클릭하여 선택
            </div>
            <div className="text-xs text-slate-400 mt-1">XLSX · XLS · CSV</div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {file && (
          <button
            onClick={() => { setFile(null); setResult(null); }}
            className="text-xs text-slate-500 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
          >
            지우기
          </button>
        )}
        <button
          onClick={upload}
          disabled={!file || uploading}
          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Lock size={13} />
          {uploading ? "등록 중..." : "사내 DB 단가 등록"}
        </button>
      </div>

      {resultData !== null && (
        <div
          className={`rounded-lg border p-4 text-sm space-y-1 ${
            isOk
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {isOk ? (
            <>
              <p className="font-medium">등록 완료</p>
              <p>
                파싱된 행: <b>{String(resultData.rowCount)}</b>건 · 저장:{" "}
                <b>{String(resultData.insertedCount)}</b>건 · 임베딩:{" "}
                <b>{String(resultData.embeddedCount)}</b>건
              </p>
              {resultData.embedError && (
                <p className="text-amber-700 text-xs">
                  임베딩 오류: {String(resultData.embedError)}
                </p>
              )}
            </>
          ) : (
            <p>{String(resultData.error ?? "알 수 없는 오류")}</p>
          )}
        </div>
      )}
    </section>
  );
}
