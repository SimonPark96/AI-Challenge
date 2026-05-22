"use client";

import { FileText, Upload, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRequestStore } from "@/lib/stores/request-store";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv";

export function QuoteUpload() {
  const file = useRequestStore((s) => s.file);
  const status = useRequestStore((s) => s.status);
  const errorMessage = useRequestStore((s) => s.errorMessage);
  const setFile = useRequestStore((s) => s.setFile);
  const uploadAndExtract = useRequestStore((s) => s.uploadAndExtract);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "uploading" && file) {
      void uploadAndExtract();
    }
  }, [status, file, uploadAndExtract]);

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }
  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  const isParsing = status === "parsing" || status === "uploading";

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className={`relative rounded-lg border-2 border-dashed transition cursor-pointer min-h-[64px] flex flex-col items-center justify-center text-center px-3 py-2 ${
        isParsing
          ? "border-blue-300 bg-blue-50"
          : file
          ? "border-emerald-300 bg-emerald-50/40"
          : "border-slate-300 bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onSelect} className="hidden" />

      {!file && (
        <>
          <Upload className="text-slate-400 mb-1.5" size={22} />
          <div className="text-sm text-slate-600">클릭 또는 파일을 드래그하여 업로드</div>
          <div className="text-[11px] text-slate-400 mt-1">PDF · JPG · PNG · WEBP · XLSX · XLS</div>
        </>
      )}

      {file && (
        <>
          <FileText className="text-blue-500 mb-1.5" size={22} />
          <div className="text-sm text-slate-800 font-medium break-all max-w-xl">{file.name}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</div>
          <div className="text-[11px] text-slate-400 mt-1">PDF · JPG · PNG · WEBP · XLSX · XLS</div>
          {isParsing && (
            <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center text-blue-600 text-sm rounded-lg">
              <Sparkles className="animate-pulse mb-1" size={20} />
              AI 추출 중...
            </div>
          )}
          {status === "error" && errorMessage && (
            <div className="mt-1.5 text-xs text-red-600 max-w-md">⚠ {errorMessage}</div>
          )}
        </>
      )}
    </div>
  );
}
