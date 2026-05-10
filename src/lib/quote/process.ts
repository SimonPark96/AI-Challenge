import { prisma } from "../prisma";
import { parseQuoteWithOpenAI } from "../openai/parse-quote";
import { EMPTY_MATCH, isMatchExcluded, matchToMarketPrice } from "./match";
import type { Prisma } from "@/generated/prisma/client";

export interface ProcessQuoteResult {
  quotationId: number;
  status: string;
  itemCount: number;
  matchedCount: number;
}

/**
 * 견적서 1건의 end-to-end 처리:
 *   1. Quotation 행 생성 (status=parsing)
 *   2. OpenAI Assistants API 로 파싱 (file_search + code_interpreter)
 *   3. 각 아이템 → PriceHistory 매칭 + 단가 비교 (% 편차)
 *   4. QuotationItem 들 cascade insert + status=compared
 *
 * 실패 시 status=failed 로 기록하고 에러 throw.
 */
export async function processQuote(
  file: File,
  fileName: string,
  fileSize: number
): Promise<ProcessQuoteResult> {
  const quote = await prisma.quotation.create({
    data: {
      fileName,
      fileSize,
      status: "parsing",
    },
  });

  try {
    const parsed = await parseQuoteWithOpenAI(file);

    const itemsData = await Promise.all(
      parsed.items.map(async (item, i) => {
        const match = isMatchExcluded(item.itemName)
          ? EMPTY_MATCH
          : await matchToMarketPrice(item.itemName, item.spec, {
              includeDebug: true,
            });
        const deviationPct =
          item.unitPrice !== null &&
          match.marketPrice !== null &&
          match.marketPrice !== 0
            ? ((item.unitPrice - match.marketPrice) / match.marketPrice) * 100
            : null;
        // 챗봇이 "왜 이 자재로 매칭됐어?" 에 답할 수 있도록 top 3 후보를 캐시.
        // 임베딩·점수 객체 전체는 무거우니 필요한 필드만 추려 저장.
        const matchDebug = match.topCandidates
          ? match.topCandidates.slice(0, 3).map((c) => ({
              source: c.source,
              itemName: c.itemName,
              spec: c.spec,
              price: c.price,
              region: c.region,
              cosine: Number(c.cosine.toFixed(3)),
              deterministic: Number(c.deterministic.toFixed(3)),
              acronym: Number(c.acronym.toFixed(3)),
              combined: Number(c.combined.toFixed(3)),
              method: c.method,
            }))
          : null;
        return {
          rowIndex: i,
          itemName: item.itemName,
          spec: item.spec,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          matchedSource: match.source === "none" ? null : match.source,
          matchedPriceId: match.matchedPriceId,
          matchedWageId: match.matchedWageId,
          matchedConfidence: match.matchedConfidence,
          marketPrice: match.marketPrice,
          marketRegion: match.marketRegion,
          deviationPct,
          matchDebug: matchDebug as Prisma.InputJsonValue | undefined,
        };
      })
    );

    await prisma.quotation.update({
      where: { id: quote.id },
      data: {
        status: "compared",
        rawResponse: parsed.raw as Prisma.InputJsonValue,
        items: { create: itemsData },
      },
    });

    const matchedCount = itemsData.filter(
      (it) => it.matchedPriceId !== null || it.matchedWageId !== null
    ).length;

    return {
      quotationId: quote.id,
      status: "compared",
      itemCount: itemsData.length,
      matchedCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.quotation.update({
      where: { id: quote.id },
      data: { status: "failed", errorMsg: message },
    });
    throw err;
  }
}
