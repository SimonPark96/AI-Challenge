import { DbSummary } from "@/components/db/DbSummary";
import { DbSearch } from "@/components/db/DbSearch";
import { DbPriceSummarySearch } from "@/components/db/DbPriceSummarySearch";
import { DbScrape } from "@/components/db/DbScrape";
import { DbExcelImport } from "@/components/db/DbExcelImport";
import { DbReset } from "@/components/db/DbReset";

export default function DbPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">DB 관리</h1>
        <p className="text-sm text-slate-500 mt-1">
          스크래핑 자재 단가(PriceHistory) 와 일괄 등록 단가합계(PriceSummary)
          를 분리해 관리합니다.
        </p>
      </header>

      <DbSummary />
      <DbScrape />
      <DbSearch />
      <DbExcelImport />
      <DbPriceSummarySearch />
      <DbReset />
    </div>
  );
}
