/**
 * DexScreener API provider — SECONDARY source (zero "@/" imports; injectable
 * fetch; unit-tested in tests/web/dexscreener.test.ts).
 *
 * Role per the verified docs (https://docs.dexscreener.com/api/reference):
 *   - GET /tokens/v1/{chain}/{address} → Pair[] snapshots (priceUsd, liquidity,
 *     volume, txns, priceChange, pairCreatedAt, info.imageUrl) at 300 req/min;
 *   - NO historical OHLCV/candle endpoint exists in the standard free API —
 *     this provider must never be used for chart history;
 *   - token profiles (`/token-profiles/latest/v1`) carry an `icon` field that
 *     can serve as a logo fallback for tokens whose own metadata is gone.
 */
import { PoolInfo, PoolKind } from "../types";
import {
  UpstreamRateLimitedError,
} from "../cache";

export const DEXSCREENER_BASE = "https://api.dexscreener.com";

export type DexErrorKind = "rate-limited" | "not-found" | "malformed" | "unavailable";

export class DexScreenerError extends Error {
  readonly kind: DexErrorKind;
  readonly retryAfterMs: number | null;
  constructor(kind: DexErrorKind, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = "DexScreenerError";
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface DexScreenerClientOptions {
  fetchImpl: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

interface RawPair {
  chainId?: unknown;
  dexId?: unknown;
  pairAddress?: unknown;
  baseToken?: { address?: unknown; name?: unknown; symbol?: unknown };
  quoteToken?: { address?: unknown; symbol?: unknown };
  priceUsd?: unknown;
  priceChange?: Record<string, unknown> | null;
  volume?: Record<string, unknown> | null;
  liquidity?: { usd?: unknown } | null;
  txns?: Record<string, { buys?: unknown; sells?: unknown }> | null;
  pairCreatedAt?: unknown;
  info?: { imageUrl?: unknown } | null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Maps DexScreener pairs to SpawnPad PoolInfo (best effort). */
export function mapDexPairs(payload: unknown): PoolInfo[] {
  if (payload == null) return [];
  const arr = Array.isArray(payload)
    ? payload
    : (payload as { pairs?: unknown }).pairs;
  if (arr === null || arr === undefined) return [];
  if (!Array.isArray(arr)) {
    throw new DexScreenerError("malformed", "pairs response is not an array");
  }
  const out: PoolInfo[] = [];
  for (const raw of arr as RawPair[]) {
    const address = asString(raw?.pairAddress);
    if (!address) continue;
    out.push({
      address,
      // DexScreener never serves Pump.fun bonding curves — always a DEX pool.
      kind: "dex-pool" as PoolKind,
      dexId: asString(raw?.dexId),
      name: asString(raw?.baseToken?.name),
      baseTokenAddress: asString(raw?.baseToken?.address),
      quoteTokenAddress: asString(raw?.quoteToken?.address),
      quoteTokenSymbol: asString(raw?.quoteToken?.symbol),
      reserveUsd: asNumber(raw?.liquidity?.usd),
      poolCreatedAt:
        typeof raw?.pairCreatedAt === "number"
          ? new Date(raw.pairCreatedAt).toISOString()
          : null,
    });
  }
  return out;
}
export interface DexPairStats {
  priceUsd: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  txns24h: { buys: number; sells: number } | null;
  iconUrl: string | null;
}

function rawPairsOf(payload: unknown): RawPair[] {
  if (payload == null) return [];
  const arr = Array.isArray(payload)
    ? payload
    : (payload as { pairs?: unknown }).pairs;
  return Array.isArray(arr) ? (arr as RawPair[]) : [];
}

/** Extracts the best pair's stats (deepest liquidity) from a pairs payload. */
export function mapBestPairStats(payload: unknown, mint: string): DexPairStats | null {
  const pairs = rawPairsOf(payload);
  const matching = pairs.filter(
    (p) =>
      asString(p?.baseToken?.address)?.toLowerCase() === mint.toLowerCase()
  );
  if (matching.length === 0) return null;
  const best = [...matching].sort(
    (a, b) => (asNumber(b?.liquidity?.usd) ?? -1) - (asNumber(a?.liquidity?.usd) ?? -1)
  )[0];
  const txns = best?.txns?.h24 ?? {};
  const buys = asNumber(txns.buys);
  const sells = asNumber(txns.sells);
  const icon = asString(best?.info?.imageUrl);
  return {
    priceUsd: asNumber(best?.priceUsd),
    change24hPct: asNumber(best?.priceChange?.h24),
    volume24hUsd: asNumber(best?.volume?.h24),
    liquidityUsd: asNumber(best?.liquidity?.usd),
    txns24h:
      buys != null || sells != null ? { buys: buys ?? 0, sells: sells ?? 0 } : null,
    iconUrl: icon && /^https:\/\//i.test(icon) ? icon : null,
  };
}

export function createDexScreenerClient(opts: DexScreenerClientOptions) {
  const base = (opts.baseUrl ?? DEXSCREENER_BASE).replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? 15_000;

  async function getJson(path: string): Promise<unknown> {
    let res: Response;
    try {
      res = await opts.fetchImpl(`${base}${path}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new DexScreenerError("unavailable", "provider unreachable or timed out");
    }
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw new UpstreamRateLimitedError(
        Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60_000
      );
    }
    if (res.status === 404) {
      throw new DexScreenerError("not-found", "entity not indexed");
    }
    if (!res.ok) {
      throw new DexScreenerError("unavailable", `provider HTTP ${res.status}`);
    }
    try {
      return await res.json();
    } catch {
      throw new DexScreenerError("malformed", "provider returned non-JSON");
    }
  }

  return {
    /** Pair snapshots for a token ([] when not indexed). */
    async tokenPairs(mint: string): Promise<PoolInfo[]> {
      try {
        const payload = await getJson(`/tokens/v1/solana/${encodeURIComponent(mint)}`);
        return mapDexPairs(payload);
      } catch (e) {
        if (e instanceof DexScreenerError && e.kind === "not-found") return [];
        throw e;
      }
    },

    /** Best-pair stats for a token (null when not indexed). */
    async bestPairStats(mint: string): Promise<DexPairStats | null> {
      const payload = await getJson(`/tokens/v1/solana/${encodeURIComponent(mint)}`);
      return mapBestPairStats(payload, mint);
    },
  };
}