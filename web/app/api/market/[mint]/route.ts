/**
 * GET /api/market/[mint] — real market-data summary for a SpawnPad token.
 *
 * Server-side only work: provider discovery (bounded, budgeted), registry
 * persistence, on-chain curve reads. Visitors share cached responses
 * (single-flight); nothing here can cascade into upstream request storms.
 */
import { NextResponse } from "next/server";
import { getMarketSummary } from "@/lib/market/service";

/** Per-IP fixed-window limiter for this route (summary polling). */
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 30; // ≥1 summary per visitor per 2s sustained
}

export async function GET(
  req: Request,
  { params }: { params: { mint: string } }
) {
  const mint = (params.mint || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
    return NextResponse.json({ ok: false, error: "invalid mint" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate limit exceeded" }, { status: 429 });
  }
  try {
    const summary = await getMarketSummary(mint);
    return NextResponse.json({ ok: true, summary });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: String((e as Error)?.message || e) },
      { status: 502 }
    );
  }
}