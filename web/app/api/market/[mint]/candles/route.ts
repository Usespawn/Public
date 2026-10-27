/**
 * GET /api/market/[mint]/candles?range=5m|1h|6h|24h|7d|30d — genuine OHLCV
 * candles from the registry's associated pool (GeckoTerminal). Responses are
 * cached per (mint, range); unindexed mints receive an honest empty result.
 */
import { NextResponse } from "next/server";
import { getCandles } from "@/lib/market/candles";
import { parseRangeLabel, CANDLE_RANGES } from "@/lib/market/types";

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 30;
}

export async function GET(
  req: Request,
  { params }: { params: { mint: string } }
) {
  const mint = (params.mint || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
    return NextResponse.json({ ok: false, error: "invalid mint" }, { status: 400 });
  }
  const url = new URL(req.url);
  const range = parseRangeLabel(url.searchParams.get("range"));
  if (!range) {
    return NextResponse.json(
      { ok: false, error: `range must be one of: ${Object.keys(CANDLE_RANGES).join(", ")}` },
      { status: 400 }
    );
  }
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate limit exceeded" }, { status: 429 });
  }
  try {
    const result = await getCandles(mint, CANDLE_RANGES[range]);
    return NextResponse.json({ ok: true, range, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: String((e as Error)?.message || e) },
      { status: 502 }
    );
  }
}