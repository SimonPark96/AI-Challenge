"use client";

import { useState } from "react";
import { DashboardSummary, type DashboardFilter } from "./DashboardSummary";
import { QuoteList } from "./QuoteList";

/**
 * 단가 검토 히스토리의 filter 상태를 들고 있는 클라이언트 wrapper.
 * - 상단 4개 큰 카드 = 필터 버튼 (전체 / 진행 중 / 완료 / 실패)
 * - 하단 견적 리스트 = 선택된 필터로 조회
 */
export function DashboardClient() {
  const [filter, setFilter] = useState<DashboardFilter>("all");
  return (
    <>
      <DashboardSummary filter={filter} onFilterChange={setFilter} />
      <QuoteList filter={filter} />
    </>
  );
}
