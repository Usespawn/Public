/**
 * GeckoTerminal Onchain API provider (zero "@/" imports — injectable fetch,
 * unit-tested in tests/web/geckoterminal.test.ts).
 *
 * Chosen over DexScreener for candles because GeckoTerminal:
 *   - indexes Pump.fun bonding curves directly as pools (DexScreener's free
 *     API does not cover most fresh curves and offers no OHLCV endpoint);
 *   - exposes genuine OHLCV: GET /networks/{net}/pools/{pool}/ohlcv/{tf}
 *     (tf = minute|hour|day; minute supports aggregate 1|5|15, limit <= 1000);
 *   - reports launchpad graduation state (completed / migrated destination).
 *
 * Public tier rate limits are tight (observed 429 after ~6 burst calls;
 * documented ~30 calls/min). All calls go through the shared rate budget +
 * single-flight cache in lib/market/cache.ts.
 */
import {
  Candle,
  GraduationInfo,
  PoolInfo,
  PoolKind,
} from "../types";
import {
  UpstreamRateLimitedError,
} from "../cache";

export const GECKOTERMINAL_BASE = "https://api.geckoterminal.com/api/v2";

export type GeckoErrorKind =
  | "rate-limited"
  | "not-found"
  | "malformed"
  | "unavailable";

export class GeckoTerminalError extends Error {
  readonly kind: GeckoErrorKind;
  readonly retryAfterMs: number | null;
  constructor(kind: GeckoErrorKind, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = "GeckoTerminalError";
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface GeckoTerminalClientOptions {
  fetchImpl: typeof fetch;
  /** Optional paid-tier key — server-side env only, never NEXT_PUBLIC_. */
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

interface RawPoolAttributes {
  address?: unknown;
  name?: unknown;
  reserve_in_usd?: unknown;
  base_token_price_usd?: unknown;
  token_price_usd?: unknown;
  price_change_percentage?: Record<string, unknown> | null;
  volume_usd?: Record<string, unknown> | null;
  transactions?: Record<string, { buys?: unknown; sells?: unknown }> | null;
  pool_created_at?: unknown;
  launchpad_details?: {
    completed?: unknown;
    graduation_percentage?: unknown;
    migrated_destination_pool_address?: unknown;
  } | null;
}

interface RawPool {
  id?: unknown;
  attributes?: RawPoolAttributes;
  relationships?: {
    base_token?: { data?: { id?: unknown } };
    quote_token?: { data?: { id?: unknown } };
    dex?: { data?: { id?: unknown } };
  };
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

/** Splits a GeckoTerminal entity id "solana_<address>" into the address. */
function addressFromId(id: unknown): string | null {
  const s = asString(id);
  if (!s) return null;
  const idx = s.indexOf("_");
  return idx >= 0 ? s.slice(idx + 1) : s;
}

/**
 * Classifies a GeckoTerminal pool for a Pump.fun-launchpad token: pools whose
 * dex is pumpfun/pump-fun ARE bonding curves, anything else is a DEX pool.
 */
function classifyPool(dexId: string | null): PoolKind {
  const d = (dexId ?? "").toLowerCase();
  if (d.includes("pumpfun") || d.includes("pump-fun")) return "pumpfun-curve";
  return "dex-pool";
}

/** "TST / SOL" → "SOL"; anything else → null (never guessed). */
function quoteSymbolFromName(name: string | null): string | null {
  if (!name) return null;
  const parts = name.split("/");
  const q = (parts[1] ?? "").trim();
  return q ? q.slice(0, 12) : null;
}
/** Maps raw GeckoTerminal pool objects to SpawnPad PoolInfo (best effort). */
export function mapGeckoPools(payload: unknown): PoolInfo[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    throw new GeckoTerminalError("malformed", "pool response missing data[]");
  }
  const out: PoolInfo[] = [];
  for (const raw of data as RawPool[]) {
    const a = raw?.attributes ?? {};
    const address = asString(a.address) ?? addressFromId(raw?.id);
    if (!address) continue;
    const dexId = addressFromId(raw?.relationships?.dex?.data?.id);
    out.push({
      address,
      kind: classifyPool(dexId),
      dexId,
      name: asString(a.name),
      baseTokenAddress: addressFromId(raw?.relationships?.base_token?.data?.id),
      quoteTokenAddress: addressFromId(raw?.relationships?.quote_token?.data?.id),
      quoteTokenSymbol: quoteSymbolFromName(asString(a.name)),
      reserveUsd: asNumber(a.reserve_in_usd),
      poolCreatedAt: asString(a.pool_created_at),
    });
  }
  return out;
}

/** Extracts launchpad graduation info from a pool/token payload. */
export function mapGraduation(payload: unknown): GraduationInfo | null {
  const data = (payload as { data?: unknown })?.data;
  if (data == null || typeof data !== "object") return null;
  const attrs = (Array.isArray(data) ? (data as unknown[])[0] : data) as
    | { attributes?: RawPoolAttributes }
    | undefined;
  const lp = attrs?.attributes?.launchpad_details;
  if (!lp || typeof lp !== "object") return null;
  return {
    completed: lp.completed === true,
    percentage: asNumber(lp.graduation_percentage),
    migratedPoolAddress: asString(lp.migrated_destination_pool_address),
  };
}

/** Extracts USD price + 24h stats from a pool/token payload.
 * Accepts both shapes: `data.attributes` (single pool/token detail) and
 * `data[].attributes` (pools list, first entry used). */
export function mapPoolStats(payload: unknown): {
  priceUsd: number | null;
  change24hPct: number | null;
  change1hPct: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  txns24h: { buys: number; sells: number } | null;
} {
  const data = (payload as { data?: unknown })?.data;
  const element = Array.isArray(data) ? data[0] : data;
  const withAttrs = element as { attributes?: RawPoolAttributes } | undefined;
  const a = (withAttrs?.attributes ?? element ?? {}) as RawPoolAttributes;
  const pc = a.price_change_percentage ?? {};
  const vol = a.volume_usd ?? {};
  const txns = a.transactions?.h24 ?? {};
  const buys = asNumber(txns.buys);
  const sells = asNumber(txns.sells);
  return {
    priceUsd: asNumber(a.token_price_usd) ?? asNumber(a.base_token_price_usd),
    change24hPct: asNumber(pc.h24),
    change1hPct: asNumber(pc.h1),
    volume24hUsd: asNumber(vol.h24),
    liquidityUsd: asNumber(a.reserve_in_usd),
    txns24h:
      buys != null || sells != null
        ? { buys: buys ?? 0, sells: sells ?? 0 }
        : null,
  };
}

/**
 * Parses GeckoTerminal's OHLCV payload: `data.attributes.ohlcv_list` is a
 * newest-first array of [unixTime, open, high, low, close, volume].
 * Returns oldest-first candles for charting; throws "malformed" on garbage.
 */
export function parseOhlcvList(payload: unknown): Candle[] {
  const data = (payload as { data?: unknown })?.data;
  const attrs = (Array.isArray(data) ? data[0] : data) as
    | { attributes?: { ohlcv_list?: unknown } }
    | undefined;
  const list = attrs?.attributes?.ohlcv_list;
  if (!Array.isArray(list)) {
    throw new GeckoTerminalError("malformed", "OHLCV response missing ohlcv_list");
  }
  const candles: Candle[] = [];
  for (const row of list) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const time = asNumber(row[0]);
    const o = asNumber(row[1]);
    const h = asNumber(row[2]);
    const l = asNumber(row[3]);
    const c = asNumber(row[4]);
    const v = row.length >= 6 ? asNumber(row[5]) : null;
    if (time == null || o == null || h == null || l == null || c == null) continue;
    candles.push({ time: Math.floor(time), open: o, high: h, low: l, close: c, volume: v });
  }
  // Provider returns newest-first; charts want oldest-first.
  return candles.reverse();
}

export interface GeckoOhlcvParams {
  timeframe: "minute" | "hour" | "day";
  aggregate?: 1 | 5 | 15;
  limit: number;
}

export function createGeckoTerminalClient(opts: GeckoTerminalClientOptions) {
  const base = (opts.baseUrl ?? GECKOTERMINAL_BASE).replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? 15_000;

  async function getJson(path: string): Promise<unknown> {
    let res: Response;
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (opts.apiKey) headers["x-cg-pro-api-key"] = opts.apiKey;
      res = await opts.fetchImpl(`${base}${path}`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new GeckoTerminalError("unavailable", "provider unreachable or timed out");
    }
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw new UpstreamRateLimitedError(
        Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60_000
      );
    }
    if (res.status === 404) {
      throw new GeckoTerminalError("not-found", "entity not indexed");
    }
    if (!res.ok) {
      throw new GeckoTerminalError("unavailable", `provider HTTP ${res.status}`);
    }
    try {
      return await res.json();
    } catch {
      throw new GeckoTerminalError("malformed", "provider returned non-JSON");
    }
  }

  return {
    /** All pools GeckoTerminal indexes for a token (empty array when none). */
    async tokenPools(mint: string): Promise<PoolInfo[]> {
      try {
        const payload = await getJson(
          `/networks/solana/tokens/${encodeURIComponent(mint)}/pools?page=1`
        );
        return mapGeckoPools(payload);
      } catch (e) {
        if (e instanceof GeckoTerminalError && e.kind === "not-found") return [];
        throw e;
      }
    },

    /** Pool summary payload (raw) for stats + graduation extraction. */
    async poolDetail(poolAddress: string): Promise<unknown> {
      return getJson(
        `/networks/solana/pools/${encodeURIComponent(poolAddress)}?include=base_token,quote_token,dex`
      );
    },

    /** Genuine OHLCV candles (oldest-first). */
    async ohlcv(poolAddress: string, params: GeckoOhlcvParams): Promise<Candle[]> {
      const q = new URLSearchParams({ limit: String(Math.min(params.limit, 1000)) });
      if (params.timeframe === "minute" && params.aggregate && params.aggregate !== 1) {
        q.set("aggregate", String(params.aggregate));
      }
      const payload = await getJson(
        `/networks/solana/pools/${encodeURIComponent(poolAddress)}/ohlcv/${params.timeframe}?${q.toString()}`
      );
      return parseOhlcvList(payload);
    },

    /** Token-level detail (price, graduation, image_url, top pools). */
    async tokenDetail(mint: string): Promise<unknown> {
      return getJson(`/networks/solana/tokens/${encodeURIComponent(mint)}`);
    },
  };
}