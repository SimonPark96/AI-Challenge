import { Package, HardHat, FileSpreadsheet, Repeat } from "lucide-react";
import { DbSummary } from "@/components/db/DbSummary";
import { DbSearch } from "@/components/db/DbSearch";
import { DbPriceSummarySearch } from "@/components/db/DbPriceSummarySearch";
import { DbScrape } from "@/components/db/DbScrape";
import { DbAutoScrape } from "@/components/db/DbAutoScrape";
import { DbWageScrape } from "@/components/db/DbWageScrape";
import { DbWageList } from "@/components/db/DbWageList";
import { DbExcelImport } from "@/components/db/DbExcelImport";
import { DbReset } from "@/components/db/DbReset";
import { DomainGroup } from "@/components/db/DomainGroup";
import { AiChatBot } from "@/components/chat/AiChatBot";

export default function DbPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">DB 관리</h1>
        <p className="text-sm text-slate-500 mt-1">
          데이터를 도메인 단위로 묶어 표시 — 각 도메인은 “수집(스크래핑/임포트)”
          과 “조회(검색)” 탭으로 분리됩니다.
        </p>
      </header>

      <DbSummary />

      <section className="space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-1 h-6 rounded bg-emerald-400" aria-hidden />
          <Repeat size={20} className="text-slate-600" />
          <h2 className="text-lg font-bold text-slate-800">자동 스크래핑</h2>
          <span className="text-xs text-slate-500 truncate">
            — 자재 단가 + 노임단가 한 사이클로 묶어 정기 실행
          </span>
        </div>
        <DbAutoScrape />
      </section>

      <DomainGroup
        title="자재 단가"
        description="외부 사이트 스크래핑 결과"
        icon={<Package size={20} />}
        accent="blue"
        tabs={[
          {
            key: "ingest",
            label: "수집",
            content: <DbScrape />,
          },
          {
            key: "search",
            label: "조회",
            content: <DbSearch />,
          },
        ]}
      />

      <DomainGroup
        title="노임 단가"
        description="KPI 직종별 일당"
        icon={<HardHat size={20} />}
        accent="amber"
        tabs={[
          {
            key: "ingest",
            label: "수집",
            content: <DbWageScrape />,
          },
          {
            key: "search",
            label: "조회",
            content: <DbWageList />,
          },
        ]}
      />

      <DomainGroup
        title="사내 DB 단가"
        description="엑셀/이미지 일괄 등록"
        icon={<FileSpreadsheet size={20} />}
        accent="emerald"
        tabs={[
          {
            key: "ingest",
            label: "수집",
            content: <DbExcelImport />,
          },
          {
            key: "search",
            label: "조회",
            content: <DbPriceSummarySearch />,
          },
        ]}
      />

      <DbReset />

      <AiChatBot mode="search" />
    </div>
  );
}
