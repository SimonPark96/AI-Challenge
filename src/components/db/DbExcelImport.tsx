"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Image as ImageIcon, Upload } from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";

const ACCEPT = ".xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.gif,.bmp";
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);

function getExt(name: string): string {
  return (name.split(".").pop() ?? "").toLowerCase();
}

export function DbExcelImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isImage = file ? IMAGE_EXT.has(getExt(file.name)) : false;

  useEffect(() => {
    if (!file || !isImage) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/db/import", {
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

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
        <FileSpreadsheet size={18} className="text-blue-500" />
        사내 DB 단가 등록
        <InfoTooltip width="w-96">
          엑셀(.xlsx/.xls/.csv) 또는 단가 자료 이미지(.png/.jpg/.webp) 를
          업로드하면 자동으로{" "}
          <b>명칭 / 규격 / 단위 / 합계(재료비·노무비·경비)</b>
          행을 감지해 일괄 단가 DB 에 등록하고 임베딩까지 생성합니다. 이
          데이터는 단가 검토 요청 페이지의 <b>합계 비교</b> 단계에서 검색·선택해
          사용됩니다. (자재 단가 DB 와는 별도)
        </InfoTooltip>
      </h2>

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
            ? "border-emerald-300 bg-emerald-50/40"
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
            {isImage && previewUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="max-h-32 max-w-[240px] object-contain rounded border border-slate-200 bg-white"
                />
                <ImageIcon size={20} className="text-emerald-500" />
              </div>
            ) : (
              <FileSpreadsheet className="text-emerald-500" size={28} />
            )}
            <div className="text-sm text-slate-800">{file.name}</div>
            <div className="text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB ·{" "}
              {isImage ? "이미지" : "스프레드시트"}
            </div>
          </div>
        ) : (
          <>
            <Upload className="text-slate-400 mx-auto mb-2" size={28} />
            <div className="text-sm text-slate-500">
              파일을 드래그하거나 클릭하여 선택
            </div>
            <div className="text-xs text-slate-400 mt-1">
              XLSX · XLS · CSV · PNG · JPG · WEBP (≤ 10MB)
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {file && (
          <button
            onClick={() => setFile(null)}
            className="text-xs text-slate-500 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
          >
            지우기
          </button>
        )}
        <button
          onClick={upload}
          disabled={!file || uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {uploading
            ? isImage
              ? "AI 인식 + 등록 중..."
              : "등록 중..."
            : "DB 에 등록"}
        </button>
      </div>

      {result !== null && (
        <pre className="bg-slate-50 border border-slate-200 p-3 rounded text-xs overflow-auto max-h-64">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
  );
}
