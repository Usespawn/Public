/**
 * Shared market-data types and pure helpers (zero imports).
 *
 * `poolKind` distinguishes the two trading phases explicitly:
 *   - "pumpfun-curve": the token trades on its Pump.fun bonding curve. The
 *     curve PDA is NOT a DEX pool — it is identified by derivation and its
 *     price comes from curve reserves (or a provider that indexes the curve).
 *   - "dex-pool": a standard AMM pool (e.g. PumpSwap after graduation).
 * Never treat a bonding-curve PDA as a DEX pool address.
 */

export type PoolKind = "pumpfun-curve" | "dex-pool" | "unknown";

export type MarketStatus =
  | "indexed" // provider data available
  | "pending-discovery" // valid on-chain launch; provider has no pool yet
  | "provider-rate-limited" // upstream 429 — cached/partial data may be present
  | "provider-unavailable" // upstream network/5xx — cached/partial data may be present
  | "no-pool"; // no on-chain curve and no provider pool

export interface Candle {
  /** UNIX seconds (UTC) of the candle open. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Quote-asset volume when the provider reports it; null otherwise. */
  volume: number | null;
}

export interface PoolInfo {
  address: string;
  kind: PoolKind;
  dexId: string | null;
  name: string | null;
  baseTokenAddress: string | null;
  quoteTokenSymbol: string | null;
  quoteTokenAddress: string | null;
  /** USD liquidity/reserve when the provider reports it; null otherwise. */
  reserveUsd: number | null;
  poolCreatedAt: string | null;
}

export interface GraduationInfo {
  completed: boolean;
  /** 0-100 progress toward graduation where the provider reports it. */
  percentage: number | null;
  /** Post-graduation migration destination pool, when it exists. */
  migratedPoolAddress: string | null;
}

export interface MarketSummary {
  mint: string;
  status: MarketStatus;
  indexed: boolean;
  /** Best pool currently used as the market source. */
  pool: PoolInfo | null;
  /** All pools discovered for the mint (best first). */
  pools: PoolInfo[];
  graduation: GraduationInfo | null;
  priceUsd: number | null;
  /** Real on-chain bonding-curve price in SOL (curve phase only). */
  priceSOL: number | null;
  /** USD price derived from on-chain curve reserves + a real SOL/USD quote. */
  curvePriceUsd: number | null;
  change24hPct: number | null;
  change1hPct: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  txns24h: { buys: number; sells: number } | null;
  /** Where the price numbers came from — always surfaced to the UI. */
  priceSource:
    | "geckoterminal"
    | "dexscreener"
    | "on-chain-bonding-curve"
    | null;
  /** Last successful upstream snapshot (server-persisted for restarts). */
  fetchedAt: number | null;
  note?: string;
}

/** Ordered candle-window plan. Every entry maps to a granularity the
 * provider genuinely supports; windows longer than the available history
 * simply return fewer candles — never padded or invented. */
export interface CandleRangePlan {
  label: "5m" | "1h" | "6h" | "24h" | "7d" | "30d";
  /** GeckoTerminal timeframe: "minute" | "hour" | "day". */
  timeframe: "minute" | "hour" | "day";
  /** GeckoTerminal aggregate bucket (minute timeframe only). */
  aggregate: 1 | 5 | 15;
  /** Candle count requested (= window length / bucket). */
  limit: number;
  /** Cache TTL for this range's upstream fetch (ms). */
  ttlMs: number;
}

export const CANDLE_RANGES: Record<CandleRangePlan["label"], CandleRangePlan> = {
  "5m": { label: "5m", timeframe: "minute", aggregate: 1, limit: 6, ttlMs: 60_000 },
  "1h": { label: "1h", timeframe: "minute", aggregate: 1, limit: 60, ttlMs: 90_000 },
  "6h": { label: "6h", timeframe: "minute", aggregate: 15, limit: 24, ttlMs: 5 * 60_000 },
  "24h": { label: "24h", timeframe: "hour", aggregate: 1, limit: 24, ttlMs: 10 * 60_000 },
  "7d": { label: "7d", timeframe: "day", aggregate: 1, limit: 7, ttlMs: 30 * 60_000 },
  "30d": { label: "30d", timeframe: "day", aggregate: 1, limit: 30, ttlMs: 60 * 60_000 },
};

export const CANDLE_RANGE_LABELS = Object.keys(CANDLE_RANGES) as Array<
  CandleRangePlan["label"]
>;

export function parseRangeLabel(raw: unknown): CandleRangePlan["label"] | null {
  if (typeof raw !== "string") return null;
  return (CANDLE_RANGE_LABELS as string[]).includes(raw)
    ? (raw as CandleRangePlan["label"])
    : null;
}

/**
 * Picks the best pool for a mint: base token must match the mint, and the
 * deepest liquidity wins. Ties keep provider order. Returns null when no
 * pool genuinely trades this mint as its base token.
 */
export function pickBestPool<T extends PoolInfo>(
  pools: T[],
  mint: string
): T | null {
  const matching = pools.filter(
    (p) => (p.baseTokenAddress ?? "").toLowerCase() === mint.toLowerCase()
  );
  if (matching.length === 0) return null;
  return [...matching].sort(
    (a, b) => (b.reserveUsd ?? -1) - (a.reserveUsd ?? -1)
  )[0];
}

/** Formats a token price for display without inventing precision. */
export function formatUsdPrice(priceUsd: number | null): string {
  if (priceUsd == null || !Number.isFinite(priceUsd)) return "—";
  if (priceUsd === 0) return "$0";
  if (priceUsd >= 1) return "$" + priceUsd.toFixed(4);
  const digits = Math.min(12, Math.max(6, Math.ceil(-Math.log10(priceUsd)) + 4));
  return "$" + priceUsd.toFixed(digits);
}