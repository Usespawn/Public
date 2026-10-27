/**
 * Single-flight TTL cache + upstream rate budget (zero imports, injectable
 * clock for tests).
 *
 * The market-data providers rate-limit aggressively (GeckoTerminal's public
 * tier throttled us after ~6 rapid calls). Every upstream fetch therefore
 * goes through:
 *   - a per-key single-flight cache (N concurrent visitors → 1 upstream call),
 *   - a global token budget (calls per minute) so bursts never cascade,
 *   - 429 responses marking the key with a provider-provided cooldown.
 * Unit-tested in tests/web/cache.test.ts.
 */

export interface TtlEntry<T> {
  value: T;
  at: number;
  ttlMs: number;
  /** Set when the upstream answered 429: do not retry before this time. */
  retryAfter?: number;
}

export class UpstreamRateLimitedError extends Error {
  readonly retryAfterMs: number | null;
  constructor(retryAfterMs: number | null) {
    super("upstream rate limited");
    this.name = "UpstreamRateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class UpstreamUnavailableError extends Error {
  constructor(message = "upstream unavailable") {
    super(message);
    this.name = "UpstreamUnavailableError";
  }
}

export interface TtlCache<T> {
  get(key: string): TtlEntry<T> | undefined;
  /** Single-flight fetch-through: concurrent callers share one promise. */
  fetchThrough(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>
  ): Promise<TtlEntry<T>>;
  /** Peek without triggering a load. */
  peek(key: string): TtlEntry<T> | undefined;
  size(): number;
}

export function createTtlCache<T>(opts?: {
  now?: () => number;
  maxEntries?: number;
}): TtlCache<T> {
  const now = opts?.now ?? (() => Date.now());
  const maxEntries = opts?.maxEntries ?? 500;
  const store = new Map<string, TtlEntry<T>>();
  const inflight = new Map<string, Promise<TtlEntry<T>>>();

  return {
    get(key) {
      const e = store.get(key);
      if (!e) return undefined;
      if (now() - e.at > e.ttlMs) return undefined; // expired value
      return e;
    },
    peek(key) {
      return store.get(key);
    },
    async fetchThrough(key, ttlMs, loader) {
      const fresh = store.get(key);
      if (fresh && now() - fresh.at < ttlMs) return fresh;

      const pending = inflight.get(key);
      if (pending) return pending;

      const p = (async () => {
        try {
          const value = await loader();
          const entry: TtlEntry<T> = { value, at: now(), ttlMs };
          store.set(key, entry);
          // Simple size guard: drop the oldest entries when over budget.
          if (store.size > maxEntries) {
            const first = store.keys().next().value;
            if (first !== undefined) store.delete(first);
          }
          return entry;
        } catch (e) {
          // Cache failure state too (short TTL) so a hot error does not
          // turn into an upstream request per visitor.
          if (e instanceof UpstreamRateLimitedError) {
            const entry: TtlEntry<T> = {
              value: undefined as unknown as T,
              at: now(),
              ttlMs: 60_000,
              retryAfter: now() + (e.retryAfterMs ?? 60_000),
            };
            store.set(key, entry);
          }
          throw e;
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, p);
      return p;
    },
    size() {
      return store.size;
    },
  };
}

/**
 * Fixed-window upstream budget: at most `ratePerMinute` calls per rolling
 * minute. `tryConsume` returns false when the budget is exhausted — callers
 * must serve cached data or an honest rate-limited state instead of calling.
 */
export interface RateBudget {
  tryConsume(): boolean;
  usedThisMinute(): number;
  limitPerMinute(): number;
}

export function createRateBudget(ratePerMinute: number, opts?: {
  now?: () => number;
}): RateBudget {
  const now = opts?.now ?? (() => Date.now());
  const hits: number[] = [];
  return {
    tryConsume() {
      const cutoff = now() - 60_000;
      while (hits.length && hits[0] <= cutoff) hits.shift();
      if (hits.length >= ratePerMinute) return false;
      hits.push(now());
      return true;
    },
    usedThisMinute() {
      const cutoff = now() - 60_000;
      while (hits.length && hits[0] <= cutoff) hits.shift();
      return hits.length;
    },
    limitPerMinute() {
      return ratePerMinute;
    },
  };
}