/**
 * Market candle service (server-only) — genuine GeckoTerminal OHLCV for the
 * registry's associated pool.
 *
 * The on-chain bonding curve cannot produce history, so unindexed mints get
 * an honest empty result. A single spot price is NEVER expanded into candles.
 * Cache TTLs come from the range plan (lib/market/types.ts); 429s surface a
 * rate-limited state with cached candles where available.
 */
import { UpstreamRateLimitedError } from "@/lib/market/cache";
import { GeckoTerminalError } from "@/lib/market/providers/geckoterminal";
import { createTtlCache } from "@/lib/market/cache";
import { Candle, CandleRangePlan } from "@/lib/market/types";
import { gecko, marketBudget, entryFor } from "@/lib/market/service";
import { fetchCurveState } from "@/lib/market/curve-price";

const candlesCache = createTtlCache<Candle[]>();

export type CandlesStatus =
  | "ok"
  | "no-history"
  | "pending-discovery"
  | "provider-rate-limited"
  | "provider-unavailable"
  | "no-pool";

export interface CandlesResult {
  candles: Candle[];
  status: CandlesStatus;
  note?: string;
  retryAfterMs?: number;
}

export async function getCandles(
  mint: string,
  plan: CandleRangePlan
): Promise<CandlesResult> {
  const entry = entryFor(mint);
  if (!entry.indexed || !entry.poolAddress) {
    const curve = await fetchCurveState(mint);
    return {
      candles: [],
      status: entry.indexed ? "no-pool" : curve.exists ? "pending-discovery" : "no-pool",
      note:
        entry.indexed
          ? "no tradable pool is associated with this mint yet"
          : curve.exists
            ? "no market history yet — the token is awaiting provider indexing; the live bonding-curve price is shown above"
            : "no market data source found for this mint",
    };
  }

  const cacheKey = `candles:${mint}:${plan.label}`;
  const cached = candlesCache.get(cacheKey);
  if (cached) {
    return {
      candles: cached.value,
      status: cached.value.length ? "ok" : "no-history",
      note: cached.value.length
        ? undefined
        : "no trades in this window yet — candles appear with real transactions",
    };
  }

  try {
    if (!marketBudget.tryConsume()) throw new UpstreamRateLimitedError(null);
    const candles = await gecko.ohlcv(entry.poolAddress, {
      timeframe: plan.timeframe,
      aggregate: plan.aggregate,
      limit: plan.limit,
    });
    const stored = await candlesCache.fetchThrough(cacheKey, plan.ttlMs, async () => candles);
    return {
      candles: stored.value,
      status: stored.value.length ? "ok" : "no-history",
      note: stored.value.length
        ? undefined
        : "no trades in this window yet — candles appear with real transactions",
    };
  } catch (e) {
    const stale = candlesCache.peek(cacheKey);
    if (e instanceof UpstreamRateLimitedError) {
      return {
        candles: stale?.value ?? [],
        status: "provider-rate-limited",
        retryAfterMs: e.retryAfterMs ?? 60_000,
        note: "provider rate-limited — cached candles shown where available",
      };
    }
    if (e instanceof GeckoTerminalError && e.kind === "malformed") {
      return {
        candles: [],
        status: "provider-unavailable",
        note: "provider returned an unreadable response",
      };
    }
    return {
      candles: stale?.value ?? [],
      status: "provider-unavailable",
      note: "provider temporarily unavailable — cached candles shown where available",
    };
  }
}