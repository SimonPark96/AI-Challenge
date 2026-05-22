import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildEmbeddingText, embedTexts } from "@/lib/openai/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * embedding 이 NULL 인 PriceHistory 를 일괄 임베딩.
 * 한 번 호출에 최대 1000건 처리 (대량이면 여러 번 호출).
 *
 * Query: ?mode=missing (기본) | all
 *   missing: embedding 이 NULL 인 행만
 *   all: 모든 행 (재생성용 — 임베딩 텍스트 정의가 바뀐 경우)
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") === "all" ? "all" : "missing";

  const targets = await prisma.priceHistory.findMany({
    where:
      mode === "all"
        ? undefined
        : { embedding: { equals: Prisma.AnyNull } },
    select: { id: true, itemName: true, spec: true },
    take: 1000,
  });

  if (targets.length === 0) {
    return NextResponse.json({
      processed: 0,
      remaining: 0,
      mode,
      message: mode === "all" ? "대상 행 없음" : "임베딩 누락 행 없음",
    });
  }

  const texts = targets.map((t) => buildEmbeddingText(t.itemName, t.spec));

  let vectors: number[][];
  try {
    vectors = await embedTexts(texts);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        attempted: targets.length,
      },
      { status: 500 }
    );
  }

  await prisma.$transaction(
    targets.map((t, i) =>
      prisma.priceHistory.update({
        where: { id: t.id },
        data: { embedding: vectors[i] as Prisma.InputJsonValue },
      })
    )
  );

  const remaining =
    mode === "all"
      ? await prisma.priceHistory.count().then((c) => c - targets.length)
      : await prisma.priceHistory.count({
          where: { embedding: { equals: Prisma.AnyNull } },
        });

  return NextResponse.json({
    processed: targets.length,
    remaining,
    mode,
  });
}
