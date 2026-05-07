import { NextResponse } from "next/server";
import { matchItemsToConfidential } from "@/lib/quote/confidential-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RequestItem {
  rowIndex: number;
  itemName: string;
  spec?: string | null;
  unitPrice?: number | null;
}

export async function POST(req: Request) {
  let body: { items?: RequestItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 파싱 실패" }, { status: 400 });
  }

  const items = (body.items ?? []).filter(
    (it) => typeof it.itemName === "string" && it.itemName.trim() !== ""
  );

  if (items.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  try {
    const matches = await matchItemsToConfidential(items);
    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
