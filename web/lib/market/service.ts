/**
 * Market-data orchestration (server-only) — summary + discovery + registry.
 *
 * Flow per mint:
 *   1. Registry (durable .data/market.json via lib/server/market-store.ts)
 *      holds restart-safe indexing state.
 *   2. Discovery (allowed by lib/market/discovery.ts): GeckoTerminal pools
 *      first, DexScreener pairs second; best pool = deepest liquidity whose
 *      base token is the mint.
 *   3. Summary: provider stats for the associated pool. For the Pump.fun
 *      curve phase the REAL on-chain curve reserves provide priceSOL (+
 *      USD via a real cached SOL/USD quote) — never an invented number.
 *   4. Provider outages serve the persisted last-good snapshot with an
 *      honest status; nothing is silently stale.
 *
 * All upstream calls flow through the single-flight TTL cache + global rate
 * budget (lib/market/cache.ts). Candles live in lib/market/candles.ts.
 */
import {
  createTtlCache,
  createRateBudget,
  UpstreamRateLimitedError,
} from "@/lib/market/cache";
import {
  createGeckoTerminalClient,
  GeckoTerminalError,
  mapGraduation,
  mapPoolStats,
} from "@/lib/market/providers/geckoterminal";
import { createDexScreenerClient, DexScreenerError } from "@/lib/market/providers/dexscreener";
import { curvePriceUsd } from "@/lib/market/pump-curve";
import { MarketSummary, pickBestPool } from "@/lib/market/types";
import {
  MarketRegistryEntry,
  createRegistryEntry,
  recordDiscoveryHit,
  recordDiscoveryMiss,
  shouldDiscover,
} from "@/lib/market/discovery";
import { getMarketEntry, upsertMarketEntry } from "@/lib/server/market-store";
import { fetchCurveState, fetchSolUsd } from "@/lib/market/curve-price";

/** Free-tier-safe upstream budget (GeckoTerminal public ≈30/min; stay low). */
export const UPSTREAM_BUDGET_PER_MIN = 20;
export const SUMMARY_TTL_MS = 45_000;
/** How long a not-indexed-yet mint's "pending" summary is cached. */
export const PENDING_TTL_MS = 20_000;

export const gecko = createGeckoTerminalClient({
  fetchImpl: fetch,
  apiKey: process.env.GECKOTERMINAL_API_KEY || undefined,
});
export const dex = createDexScreenerClient({ fetchImpl: fetch });
export const marketBudget = createRateBudget(UPSTREAM_BUDGET_PER_MIN);

const summaryCache = createTtlCache<MarketSummary>();

export function entryFor(mint: string): MarketRegistryEntry {
  return getMarketEntry(mint) ?? createRegistryEntry(mint);
}

/** One bounded discovery attempt across both providers. */
export async function discoverOnce(
  mint: string,
  entry: MarketRegistryEntry
): Promise<MarketRegistryEntry> {
  const now = Date.now();
  if (!marketBudget.tryConsume()) {
    return recordDiscoveryMiss(entry, now, "upstream budget exhausted — retrying later");
  }
  try {
    const pools = await gecko.tokenPools(mint);
    const best = pickBestPool(pools, mint);
    if (best) {
      return recordDiscoveryHit(entry, {
        source: "geckoterminal",
        poolAddress: best.address,
        poolKind: best.kind === "unknown" ? null : best.kind,
        quoteSymbol: best.quoteTokenSymbol,
        now,
      });
    }
    // Secondary: DexScreener (mainly useful after graduation).
    const dexPools = await dex.tokenPairs(mint);
    const dexBest = pickBestPool(dexPools, mint);
    if (dexBest) {
      return recordDiscoveryHit(entry, {
        source: "dexscreener",
        poolAddress: dexBest.address,
        poolKind: dexBest.kind === "unknown" ? null : dexBest.kind,
        quoteSymbol: dexBest.quoteTokenSymbol,
        now,
      });
    }
    return recordDiscoveryMiss(entry, now, "no indexed pool yet — provider has not picked up the token");
  } catch (e) {
    const reason =
      e instanceof UpstreamRateLimitedError
        ? "provider rate-limited — retrying later"
        : e instanceof GeckoTerminalError || e instanceof DexScreenerError
          ? `${(e as Error).name}: ${(e as Error).message}`
          : "provider error";
    return recordDiscoveryMiss(entry, now, reason);
  }
}
/** Assembles the summary for a registry entry (provider or curve fallback). */
async function buildSummary(
  mint: string,
  entry: MarketRegistryEntry
): Promise<MarketSummary> {
  const base: MarketSummary = {
    mint,
    status: entry.indexed ? "indexed" : "pending-discovery",
    indexed: entry.indexed,
    pool: null,
    pools: [],
    graduation: null,
    priceUsd: null,
    priceSOL: null,
    curvePriceUsd: null,
    change24hPct: null,
    change1hPct: null,
    volume24hUsd: null,
    liquidityUsd: null,
    txns24h: null,
    priceSource: null,
    fetchedAt: null,
  };

  if (!entry.indexed || !entry.poolAddress) {
    // Honest pending state + REAL on-chain curve price when the curve exists.
    const curve = await fetchCurveState(mint);
    if (curve.exists) {
      const solUsd = await fetchSolUsd();
      base.priceSOL = curve.priceSOL;
      base.curvePriceUsd = curvePriceUsd(curve.priceSOL, solUsd);
      base.priceSource = "on-chain-bonding-curve";
      base.graduation = {
        completed: curve.complete === true,
        percentage: null,
        migratedPoolAddress: null,
      };
    }
    base.note = entry.lastError ?? undefined;
    return base;
  }

  // Indexed: provider stats for the associated pool.
  try {
    if (!marketBudget.tryConsume()) throw new UpstreamRateLimitedError(null);
    const detail = await gecko.poolDetail(entry.poolAddress);
    const stats = mapPoolStats(detail);
    const graduation = mapGraduation(detail);
    const found = (await gecko.tokenPools(mint)).find(
      (p) => p.address === entry.poolAddress
    );
    const pool = found ?? {
      address: entry.poolAddress,
      kind: entry.poolKind ?? ("unknown" as const),
      dexId: null,
      name: null,
      baseTokenAddress: mint,
      quoteTokenAddress: null,
      quoteTokenSymbol: entry.quoteSymbol,
      reserveUsd: stats.liquidityUsd,
      poolCreatedAt: null,
    };
    const summary: MarketSummary = {
      ...base,
      status: "indexed",
      indexed: true,
      pool,
      pools: [pool],
      graduation,
      priceUsd: stats.priceUsd,
      change24hPct: stats.change24hPct,
      change1hPct: stats.change1hPct,
      volume24hUsd: stats.volume24hUsd,
      liquidityUsd: stats.liquidityUsd,
      txns24h: stats.txns24h,
      priceSource: "geckoterminal",
      fetchedAt: Date.now(),
    };
    // Persist the last-good snapshot for provider outages / restarts.
    upsertMarketEntry({
      ...entry,
      lastGoodAt: Date.now(),
      lastGoodSummary: summary as unknown as Record<string, unknown>,
    });
    return summary;
  } catch (e) {
    const status: MarketSummary["status"] =
      e instanceof UpstreamRateLimitedError ? "provider-rate-limited" : "provider-unavailable";
    const lastGood = entry.lastGoodSummary as unknown as MarketSummary | null;
    if (lastGood && lastGood.mint === mint) {
      const ageMin = Math.round((Date.now() - (entry.lastGoodAt ?? 0)) / 60_000);
      return {
        ...lastGood,
        status,
        note:
          status === "provider-rate-limited"
            ? "provider rate-limited — showing the last successful snapshot"
            : `provider unavailable — showing the last successful snapshot (${ageMin} min old)`,
      };
    }
    // No snapshot yet: fall back to the curve-phase summary honestly.
    const unindexedEntry = entry.indexed ? { ...entry, indexed: false } : entry;
    return await buildSummaryForUnindexed(mint, unindexedEntry, status);
  }
}

/** Curve-fallback summary for unindexed mints (shared by both paths). */
async function buildSummaryForUnindexed(
  mint: string,
  entry: MarketRegistryEntry,
  status: MarketSummary["status"]
): Promise<MarketSummary> {
  const curve = await fetchCurveState(mint);
  const solUsd = curve.exists ? await fetchSolUsd() : null;
  return {
    mint,
    status,
    indexed: false,
    pool: null,
    pools: [],
    graduation: curve.exists
      ? { completed: curve.complete === true, percentage: null, migratedPoolAddress: null }
      : null,
    priceUsd: null,
    priceSOL: curve.exists ? curve.priceSOL : null,
    curvePriceUsd: curvePriceUsd(curve.priceSOL, solUsd),
    change24hPct: null,
    change1hPct: null,
    volume24hUsd: null,
    liquidityUsd: null,
    txns24h: null,
    priceSource: curve.exists ? "on-chain-bonding-curve" : null,
    fetchedAt: null,
    note: entry.lastError ?? undefined,
  };
}

/**
 * Market summary for a mint — single-flight cached, with bounded discovery
 * on registry misses (schedule survives restarts via the durable registry).
 */
export async function getMarketSummary(mint: string): Promise<MarketSummary> {
  const cacheKey = `summary:${mint}`;
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached.value;

  const loaded = await summaryCache.fetchThrough(
    cacheKey,
    entryFor(mint).indexed ? SUMMARY_TTL_MS : PENDING_TTL_MS,
    async () => {
      let current = entryFor(mint);
      if (shouldDiscover(current, Date.now())) {
        current = upsertMarketEntry(await discoverOnce(mint, current));
      }
      return buildSummary(mint, current);
    }
  );
  return loaded.value;
}