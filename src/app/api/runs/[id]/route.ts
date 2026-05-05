import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const runId = Number(id);
  if (!Number.isFinite(runId) || runId <= 0) {
    return NextResponse.json(
      { error: `Invalid id: ${id}` },
      { status: 400 }
    );
  }

  const run = await prisma.scrapeRun.findUnique({
    where: { id: runId },
    include: {
      prices: { orderBy: { id: "asc" }, take: 500 },
      _count: { select: { prices: true } },
    },
  });

  if (!run) {
    return NextResponse.json(
      { error: `ScrapeRun #${runId} not found` },
      { status: 404 }
    );
  }

  return NextResponse.json({ run });
}
