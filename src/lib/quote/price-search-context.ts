import { prisma } from "../prisma";
import type { Prisma } from "@/generated/prisma/client";

const WAGE_CATE_LABELS: Record<string, string> = {
  "701111": "공사부문",
  "701115": "기타직종",
};

// 사용자 질문에서 의미 없는 일반어 제거
const STOPWORDS = new Set([
  "단가",
  "가격",
  "얼마",
  "얼마야",
  "얼마인가",
  "얼마인가요",
  "알려줘",
  "찾아줘",
  "찾아",
  "검색",
  "보여줘",
  "주세요",
  "원해",
  "이건",
  "이거",
  "이건요",
  "안녕",
  "ㅇㅇ",
]);

function tokenize(s: string): string[] {
  const raw = s.match(/[가-힣A-Za-z0-9]+/g) ?? [];
  return raw.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * 합성어 매칭 강화 — 한글 자재명("고장력철근", "폴리카보네이트복층판") 처럼
 * 사용자가 입력한 토큰("이형철근") 통째로는 매칭이 안 되지만 부분어("철근")는
 * 매칭되는 경우가 많아, 길이≥3 의 토큰을 길이 2 sliding-window 로 분해해 함께
 * OR 검색에 사용한다.
 *
 * 예: "이형철근" → ["이형철근", "이형", "형철", "철근"]
 *     "AL" → ["AL"]                    (이미 짧으니 분해 X)
 *     "강판" → ["강판"]                 (길이 2 라 분해 X)
 *     "고장력철근" → ["고장력철근", "고장", "장력", "력철", "철근"]
 *
 * 영문 stopword 같은 너무 흔한 길이 2 substring 은 STOPWORDS 로 차단된 토큰에서
 * 파생될 일이 거의 없고, 자재명 도메인에선 길이 2 한글이 충분히 변별력 있음.
 */
/**
 * prefetch 결과를 토큰 매칭 관련도로 재정렬.
 * - 기준: 후보 텍스트에 포함된 base 토큰들의 길이 합 (긴 토큰일수록 강한 신호)
 * - tie 일 때 fetchedAt desc 유지 (caller 에서 이미 정렬돼 들어온 순서 보존)
 * - 점수 0 인 후보는 사실상 무관해 보이지만, 어차피 OR 매칭으로 들어온 것이라 1점은 줘서 뒤로 밀음
 */
function rankByTokens<
  T extends { itemName?: string; jobName?: string; name?: string; spec?: string | null; description?: string | null }
>(rows: T[], baseTokens: string[]): T[] {
  if (baseTokens.length === 0) return rows;
  const lowered = baseTokens.map((t) => t.toLowerCase());
  function score(r: T): number {
    const text = [
      r.itemName ?? "",
      r.jobName ?? "",
      r.name ?? "",
      r.spec ?? "",
      r.description ?? "",
    ]
      .join(" ")
      .toLowerCase();
    let s = 0;
    for (const t of lowered) {
      if (text.includes(t)) s += t.length;
    }
    return s;
  }
  return rows
    .map((r, i) => ({ r, s: score(r), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r);
}

function expandTokens(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) {
    out.add(t);
    if (t.length >= 3) {
      for (let i = 0; i + 2 <= t.length; i++) {
        out.add(t.slice(i, i + 2));
      }
    }
  }
  return [...out];
}

function ymd(d: Date | null | undefined): string {
  if (!d) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtNum(n: number | null | undefined): string {
  return n != null ? n.toLocaleString() : "-";
}

const SYSTEM_INSTRUCTIONS = `당신은 사내 단가 DB 검색 도우미입니다.
사용자가 질문한 품목/직종/항목을 [DB 검색 결과] 블록 안에서 찾아 답하세요.

규칙:
1. 답변의 사실은 반드시 [DB 검색 결과] 의 데이터를 인용해야 합니다. 가격·규격·출처를
   지어내지 마세요.
2. 사용자 질문어와 정확히 일치하는 항목이 결과에 있으면 그것을 우선 보여주세요.
3. 정확 일치가 없어도 결과 블록에 **비슷한 항목이 있으면 그것을 후보로 제시**하세요.
   "정확히 일치하는 항목은 없지만 비슷한 후보:" 식으로 안내하고, 1~5건 추려서 보여주세요.
   결과 목록은 위에서부터 관련도 순으로 정렬돼 있어, 상위 항목이 보통 가장 유사합니다.
4. 결과가 여러 건이고 사용자가 규격(spec)·카테고리·지역 등을 명시하지 않으면,
   바로 단가를 답하기보단 **간단한 옵션 목록과 함께 어떤 규격을 찾는지 되물어 주세요**.
   예) "다음 중 어떤 규격을 찾으세요? 1) D10 2) D13 3) D16"
5. 결과가 1~3건이거나 사용자가 구체적으로 말한 경우엔 단가를 바로 답하되, 형식:
   "품명 / 규격 / 단위 / 가격 / 출처(KPI 등) / 수집일"
6. 결과 블록에 자재·노임·일괄 단가 어디에도 관련 항목이 전혀 없을 때만
   "데이터베이스에 해당 품목이 없습니다" 라고 답하세요.
7. 노임은 직종·일당, 일괄 단가는 명칭별 합계(재료비/노무비/경비 분해 포함).
8. 본 시스템은 사이클마다 DB 가 swap 되어 단일 시점만 보존됩니다. 시계열 추이는
   제공 불가.
9. 한국어, 간결한 톤. 불필요한 인사·면책 없이 본론으로.

[중요] 사용자가 규격 등을 추가로 답하면 새 질문이 아니라 이전 질문의 후속이라
인식하고 그에 맞춰 답하세요 (대화 히스토리를 활용).`;

export interface BuildPriceSearchContextResult {
  systemPrompt: string;
  hitCounts: { material: number; wage: number; summary: number };
}

/**
 * 사용자의 최근 메시지들을 합친 hint 로 자재/노임/일괄 단가 DB 에서 후보를 prefetch 한 뒤,
 * 그 결과를 시스템 프롬프트의 [DB 검색 결과] 블록으로 인라인.
 *
 * - hint 가 비어있거나 매칭 토큰이 없으면 결과 블록은 비어있고 AI 가 "어떤 항목 찾으세요?" 라고 묻게 됨
 * - 토큰들은 OR 매칭 (어떤 토큰이라도 itemName/spec 에 들어있는 후보)
 * - 각 도메인 최대 50건 (성능 + 토큰 비용)
 */
export async function buildPriceSearchContext(
  hint: string
): Promise<BuildPriceSearchContextResult> {
  const baseTokens = tokenize(hint).slice(0, 8); // 사용자 입력의 핵심 토큰
  // 합성어 매칭 강화 — 길이 2 substring 으로 분해해 OR 검색. 너무 많은 OR 절은
  // SQL 비용 ↑ 이라 토큰 + substring 합쳐 30개로 캡.
  const tokens = expandTokens(baseTokens).slice(0, 30);

  const limitMaterial = 50;
  const limitWage = 30;
  const limitSummary = 30;

  let materials: Array<{
    id: number;
    source: string;
    itemName: string;
    spec: string | null;
    unit: string | null;
    region: string | null;
    price: number | null;
    fetchedAt: Date;
  }> = [];
  let wages: Array<{
    id: number;
    cateCd: string;
    jobName: string;
    unit: string | null;
    basis: string | null;
    price: number | null;
    fetchedAt: Date;
    description: string | null;
  }> = [];
  let summaries: Array<{
    id: number;
    name: string;
    spec: string | null;
    unit: string | null;
    totalCost: number | null;
    materialCost: number | null;
    laborCost: number | null;
    expenseCost: number | null;
    sourceFile: string | null;
    fetchedAt: Date;
  }> = [];

  if (tokens.length > 0) {
    const matWhere: Prisma.PriceHistoryWhereInput = {
      OR: tokens.flatMap((t) => [
        { itemName: { contains: t } },
        { spec: { contains: t } },
      ]),
    };
    const wageWhere: Prisma.WageHistoryWhereInput = {
      OR: tokens.flatMap((t) => [
        { jobName: { contains: t } },
        { description: { contains: t } },
      ]),
    };
    const sumWhere: Prisma.PriceSummaryWhereInput = {
      OR: tokens.flatMap((t) => [
        { name: { contains: t } },
        { spec: { contains: t } },
      ]),
    };

    // 일단 넓게(최대 300) 가져와서 base 토큰 매칭 점수로 재정렬한 뒤 상위 limit 만 사용.
    const fetchCap = 300;
    const [matRaw, wageRaw, sumRaw] = await Promise.all([
      prisma.priceHistory.findMany({
        where: matWhere,
        orderBy: [{ fetchedAt: "desc" }, { id: "asc" }],
        take: fetchCap,
        select: {
          id: true,
          source: true,
          itemName: true,
          spec: true,
          unit: true,
          region: true,
          price: true,
          fetchedAt: true,
        },
      }),
      prisma.wageHistory.findMany({
        where: wageWhere,
        orderBy: [{ fetchedAt: "desc" }, { jobName: "asc" }],
        take: fetchCap,
        select: {
          id: true,
          cateCd: true,
          jobName: true,
          unit: true,
          basis: true,
          price: true,
          fetchedAt: true,
          description: true,
        },
      }),
      prisma.priceSummary.findMany({
        where: sumWhere,
        orderBy: [{ fetchedAt: "desc" }, { id: "desc" }],
        take: fetchCap,
        select: {
          id: true,
          name: true,
          spec: true,
          unit: true,
          totalCost: true,
          materialCost: true,
          laborCost: true,
          expenseCost: true,
          sourceFile: true,
          fetchedAt: true,
        },
      }),
    ]);

    materials = rankByTokens(matRaw, baseTokens).slice(0, limitMaterial);
    wages = rankByTokens(wageRaw, baseTokens).slice(0, limitWage);
    summaries = rankByTokens(sumRaw, baseTokens).slice(0, limitSummary);
  }

  const materialBlock =
    materials.length > 0
      ? materials
          .map(
            (p, i) =>
              `${String(i + 1).padStart(2, "0")}. ${p.itemName}${p.spec ? ` / ${p.spec}` : ""} / ${p.unit ?? "-"} / ${fmtNum(p.price)}원 / ${p.region ?? "-"} / ${p.source.toUpperCase()} / ${ymd(p.fetchedAt)}`
          )
          .join("\n")
      : "  (매칭된 자재 단가 없음)";

  const wageBlock =
    wages.length > 0
      ? wages
          .map(
            (w, i) =>
              `${String(i + 1).padStart(2, "0")}. ${w.jobName} / ${w.unit ?? "-"} / ${fmtNum(w.price)}원 / ${WAGE_CATE_LABELS[w.cateCd] ?? w.cateCd} / 기준 ${w.basis ?? "-"} / ${ymd(w.fetchedAt)}`
          )
          .join("\n")
      : "  (매칭된 노임 단가 없음)";

  const summaryBlock =
    summaries.length > 0
      ? summaries
          .map(
            (s, i) =>
              `${String(i + 1).padStart(2, "0")}. ${s.name}${s.spec ? ` / ${s.spec}` : ""} / ${s.unit ?? "-"} / 합계 ${fmtNum(s.totalCost)}원` +
              ` (재료비 ${fmtNum(s.materialCost)} / 노무비 ${fmtNum(s.laborCost)} / 경비 ${fmtNum(s.expenseCost)})` +
              ` / 파일 ${s.sourceFile ?? "-"} / ${ymd(s.fetchedAt)}`
          )
          .join("\n")
      : "  (매칭된 일괄 단가 없음)";

  const hitInfo =
    baseTokens.length === 0
      ? "(검색 키워드가 아직 없음 — 사용자에게 어떤 품목/직종을 찾는지 물어보세요)"
      : `검색 토큰: [${baseTokens.join(", ")}] (substring 확장 ${tokens.length}개)`;

  const systemPrompt = `${SYSTEM_INSTRUCTIONS}

[DB 검색 결과]
${hitInfo}

[자재 단가 — ${materials.length}건]
${materialBlock}

[노임 단가 — ${wages.length}건]
${wageBlock}

[일괄 단가 — ${summaries.length}건]
${summaryBlock}`;

  return {
    systemPrompt,
    hitCounts: {
      material: materials.length,
      wage: wages.length,
      summary: summaries.length,
    },
  };
}
