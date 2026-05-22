import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PriceSummary 필터용 facets — 본부 distinct 목록 + 계약일자 전체 범위.
 * 자동 매칭 카드의 select / date input 옵션 채울 때 사용.
 */
export async function GET() {
  const [divisions, projects, dateAgg] = await Promise.all([
    prisma.priceSummary.findMany({
      where: { businessDivision: { not: null } },
      select: { businessDivision: true },
      distinct: ["businessDivision"],
      orderBy: { businessDivision: "asc" },
    }),
    prisma.priceSummary.findMany({
      where: { projectName: { not: null } },
      select: { projectName: true },
      distinct: ["projectName"],
      orderBy: { projectName: "asc" },
      take: 300,
    }),
    prisma.priceSummary.aggregate({
      _min: { firstContractDate: true },
      _max: { lastContractDate: true },
    }),
  ]);

  return NextResponse.json({
    businessDivisions: divisions
      .map((d) => d.businessDivision)
      .filter((v): v is string => v != null),
    projectNames: projects
      .map((p) => p.projectName)
      .filter((v): v is string => v != null),
    contractDateRange: {
      min: dateAgg._min.firstContractDate
        ? dateAgg._min.firstContractDate.toISOString()
        : null,
      max: dateAgg._max.lastContractDate
        ? dateAgg._max.lastContractDate.toISOString()
        : null,
    },
  });
}
