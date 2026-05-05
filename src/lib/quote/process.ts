import { prisma } from "../prisma";
import { parseQuoteWithOpenAI } from "../openai/parse-quote";
import { matchToMarketPrice } from "./match";
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
        const match = await matchToMarketPrice(item.itemName, item.spec);
        const deviationPct =
          item.unitPrice !== null &&
          match.marketPrice !== null &&
          match.marketPrice !== 0
            ? ((item.unitPrice - match.marketPrice) / match.marketPrice) * 100
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
