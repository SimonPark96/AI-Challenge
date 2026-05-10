import Link from "next/link";
import { Sparkles } from "lucide-react";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { AiChatBot } from "@/components/chat/AiChatBot";

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">검토 요청 목록</h1>
          <p className="text-sm text-slate-500 mt-1">
            진행 중 / 완료된 단가 분석 요청 리스트.
          </p>
        </div>
        <Link
          href="/request"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
        >
          <Sparkles size={14} />새 단가 검토 요청
        </Link>
      </header>

      <DashboardClient />

      <AiChatBot mode="search" />
    </div>
  );
}
