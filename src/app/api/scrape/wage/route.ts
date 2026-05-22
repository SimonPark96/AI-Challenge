import { NextResponse } from "next/server";
import { runWageScrape } from "@/lib/scrape/run-wage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await runWageScrape({ log: (m) => console.log(m) });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
