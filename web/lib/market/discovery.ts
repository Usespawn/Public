/**
 * Pure discovery/reconciliation planning for the market registry (zero
 * imports; unit-tested in tests/web/discovery.test.ts).
 *
 * The server keeps one registry entry per mint (persisted in .data/market.json
 * via lib/server/market-store.ts). This module decides — statelessly — when
 * upstream discovery may run and with which backoff, so restarts inherit the
 * schedule and no worker can hammer a rate-limited provider.
 */

export const DISCOVERY_MAX_RETRIES = 6;
/** Backoff schedule for "provider has not indexed it yet": 30s→1m→2m→4m→8m→16m. */
export const DISCOVERY_BACKOFF_MS = [
  30_000, 60_000, 120_000, 240_000, 480_000, 960_000,
] as const;

export interface MarketRegistryEntry {
  mint: string;
  /** Whether a pool/curve has been associated with this mint. */
  indexed: boolean;
  source: "geckoterminal" | "dexscreener" | "on-chain" | null;
  poolAddress: string | null;
  poolKind: "pumpfun-curve" | "dex-pool" | null;
  quoteSymbol: string | null;
  /** Last upstream success (ms epoch) — feeds restart-safe summaries. */
  lastGoodAt: number | null;
  /** Bounded retry bookkeeping for not-indexed-yet tokens. */
  retryCount: number;
  /** Earliest next discovery attempt (ms epoch). */
  nextRetryAt: number | null;
  lastError: string | null;
  /** Persisted last-good summary snapshot for provider outages. */
  lastGoodSummary?: Record<string, unknown> | null;
}

export function createRegistryEntry(mint: string): MarketRegistryEntry {
  return {
    mint,
    indexed: false,
    source: null,
    poolAddress: null,
    poolKind: null,
    quoteSymbol: null,
    lastGoodAt: null,
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
    lastGoodSummary: null,
  };
}

/**
 * True when a discovery attempt is allowed now:
 *  - indexed mints only refresh on their normal summary TTL (handled by the
 *    cache), so discovery here concerns UNINDEXED mints only;
 *  - retries are bounded by DISCOVERY_MAX_RETRIES;
 *  - the stored nextRetryAt schedule must have elapsed (restart-safe).
 */
export function shouldDiscover(
  entry: MarketRegistryEntry | undefined,
  now: number
): boolean {
  if (!entry) return true; // first sight of this mint
  if (entry.indexed) return false; // discovery done; summary TTL handles refresh
  if (entry.retryCount >= DISCOVERY_MAX_RETRIES) return false; // bounded
  if (entry.nextRetryAt != null && now < entry.nextRetryAt) return false;
  return true;
}

/** Records a failed (not-yet-indexed) discovery attempt; returns the update. */
export function recordDiscoveryMiss(
  entry: MarketRegistryEntry,
  now: number,
  reason: string
): MarketRegistryEntry {
  const retryCount = Math.min(entry.retryCount + 1, DISCOVERY_MAX_RETRIES);
  const exhausted = entry.retryCount >= DISCOVERY_MAX_RETRIES;
  const backoff =
    DISCOVERY_BACKOFF_MS[
      Math.min(entry.retryCount, DISCOVERY_BACKOFF_MS.length - 1)
    ] ?? 960_000;
  return {
    ...entry,
    retryCount,
    nextRetryAt: exhausted ? entry.nextRetryAt : now + backoff,
    lastError: reason,
  };
}

/** Records a successful discovery. */
export function recordDiscoveryHit(
  entry: MarketRegistryEntry,
  update: {
    source: MarketRegistryEntry["source"];
    poolAddress: string;
    poolKind: MarketRegistryEntry["poolKind"];
    quoteSymbol: string | null;
    now: number;
  }
): MarketRegistryEntry {
  return {
    ...entry,
    indexed: true,
    source: update.source,
    poolAddress: update.poolAddress,
    poolKind: update.poolKind,
    quoteSymbol: update.quoteSymbol,
    lastGoodAt: update.now,
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
  };
}