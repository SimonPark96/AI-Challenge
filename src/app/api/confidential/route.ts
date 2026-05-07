import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 10_000) || 10_000, 1),
    10_000
  );

  const rows = await prisma.confidentialPrice.findMany({
    orderBy: [{ fetchedAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  const qTokens = q
    ? q.split(/\s+/).filter((t) => t.length > 0).map(normalize)
    : [];

  const filtered = rows.filter((r) => {
    if (qTokens.length === 0) return true;
    const nameN = normalize(r.name);
    const specN = r.spec ? normalize(r.spec) : "";
    for (const t of qTokens) {
      if (!nameN.includes(t) && !specN.includes(t)) return false;
    }
    return true;
  });

  const prices = filtered.map((r) => ({
    id: r.id,
    name: r.name,
    spec: r.spec,
    unit: r.unit,
    materialCost: r.materialCost,
    laborCost: r.laborCost,
    expenseCost: r.expenseCost,
    totalCost: r.totalCost,
    sourceFile: r.sourceFile,
    fetchedAt: r.fetchedAt,
    hasEmbedding: Array.isArray(r.embedding),
  }));

  return NextResponse.json({ count: prices.length, prices });
}
