import { NextResponse } from "next/server";
import { runScrape } from "@/lib/scrape/run";
import type { ScrapeSource } from "@/lib/scrapers/types";

const VALID_SOURCES: readonly ScrapeSource[] = ["kpi", "kprc", "cmpi"] as const;

function isValidSource(s: string): s is ScrapeSource {
  return (VALID_SOURCES as readonly string[]).includes(s);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ source: string }> }
) {
  const { source } = await context.params;
  if (!isValidSource(source)) {
    return NextResponse.json(
      { error: `Invalid source: ${source}. Allowed: ${VALID_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }

  let body: { keyword?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { keyword: string }" },
      { status: 400 }
    );
  }

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword) {
    return NextResponse.json(
      { error: "keyword is required (non-empty string)" },
      { status: 400 }
    );
  }

  try {
    const result = await runScrape(source, keyword);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, source, keyword },
      { status: 500 }
    );
  }
}
