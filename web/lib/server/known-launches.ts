/**
 * Committed seed registry of confirmed SpawnPad launches (pure module —
 * zero "@/lib" imports so the root ts-mocha suite can test it directly).
 *
 * WHY THIS EXISTS: the runtime launch registry (web/.data/launches.json) is
 * per-deployment filesystem state. A freshly deployed instance has an empty
 * registry, so Explore renders nothing even though the launches exist on
 * Mainnet. The seed list below SHIPS WITH THE CODE, so every deployment
 * knows which mints are SpawnPad launches; the listing API then re-verifies
 * each missing mint against the chain (never trusting the list alone)
 * before listing it. Entries here are REAL, previously verified launches.
 *
 * Growth path: verified launches on a persistent production host accumulate
 * in that host's own registry; for a registry shared across instances, set
 * SPAWNPAD_LAUNCH_FEED_URL to a hosted JSON feed (array of mints or
 * {mint, signature?, name?, symbol?} objects) — merged after strict
 * validation. No credentials are required or embedded.
 */
import { isSpawnVanityAddress } from "../config";

export interface LaunchSeed {
  mint: string;
  /** Create-transaction signature when known — speeds up verification. */
  signature?: string;
  /** Recorded at verification time; on-chain metadata always wins. */
  name?: string;
  symbol?: string;
  network?: string;
  addedAt?: string;
  /** Provenance of the entry (committed seed vs remote feed). */
  origin: "committed" | "remote";
}

/** Real, previously verified SpawnPad launches (provenance: local verified
 * registry + on-chain confirmation; see tests/web fixtures). */
export const KNOWN_LAUNCH_SEEDS: Array<Omit<LaunchSeed, "origin">> = [
  {
    mint: "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw",
    signature:
      "573GqJL6Y7GrMhM4No7xD73w4CzSLFmXASexD56cBWakAfxyD1Qb4rqEjK5fKdjWyeWgxvMN2aTnrsgJhikeHbFY",
    name: "test",
    symbol: "TST",
    network: "mainnet-beta",
    addedAt: "2026-10-26",
  },
];

const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{32,88}$/;
const MAX_FEED_ENTRIES = 500;

/** Validates one raw seed entry; returns null when it must be rejected.
 * Accepts a bare mint string (remote feed shorthand) or a seed object. */
export function parseSeedEntry(raw: unknown, origin: LaunchSeed["origin"]): LaunchSeed | null {
  if (typeof raw === "string") {
    const mint = raw.trim();
    if (!isSpawnVanityAddress(mint)) return null;
    return { mint, origin };
  }
  if (raw == null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const mint = typeof r.mint === "string" ? r.mint.trim() : "";
  // Exact case-sensitive `Spw` suffix requirement — a matching suffix alone
  // is not trusted; the reconciler still re-verifies each mint on-chain.
  if (!isSpawnVanityAddress(mint)) return null;
  if (
    typeof r.signature !== "undefined" &&
    (typeof r.signature !== "string" || !SIG_RE.test(r.signature.trim()))
  ) {
    return null;
  }
  const seed: LaunchSeed = { mint, origin };
  if (typeof r.signature === "string") seed.signature = r.signature.trim();
  if (typeof r.name === "string" && r.name.trim()) seed.name = r.name.trim().slice(0, 64);
  if (typeof r.symbol === "string" && r.symbol.trim()) seed.symbol = r.symbol.trim().slice(0, 16);
  if (typeof r.network === "string" && r.network.trim()) seed.network = r.network.trim();
  if (typeof r.addedAt === "string" && r.addedAt.trim()) seed.addedAt = r.addedAt.trim();
  return seed;
}

/** Normalizes a raw list: validates, dedupes by mint (first wins). */
export function normalizeSeeds(
  rawList: unknown,
  origin: LaunchSeed["origin"]
): { seeds: LaunchSeed[]; invalid: number } {
  if (!Array.isArray(rawList)) return { seeds: [], invalid: Array.isArray(rawList) ? 0 : 1 };
  const seeds: LaunchSeed[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  for (const raw of rawList) {
    if (seeds.length >= MAX_FEED_ENTRIES) break;
    const seed = parseSeedEntry(raw, origin);
    if (!seed) {
      invalid++;
      continue;
    }
    if (seen.has(seed.mint)) {
      invalid++;
      continue;
    }
    seen.add(seed.mint);
    seeds.push(seed);
  }
  return { seeds, invalid };
}
/**
 * Fetches the optional remote launch feed. Accepts an array of mint strings
 * or seed objects. Failures are returned as {error} — never thrown — so the
 * listing API can serve local data with an explicit degraded note.
 */
export async function fetchRemoteSeeds(
  url: string,
  opts: { fetchImpl: typeof fetch; timeoutMs?: number }
): Promise<{ seeds: LaunchSeed[]; invalid: number; error?: string }> {
  try {
    const res = await opts.fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    if (!res.ok) {
      return { seeds: [], invalid: 0, error: `feed HTTP ${res.status}` };
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { seeds: [], invalid: 0, error: "feed returned non-JSON" };
    }
    const asBody = body as { mints?: unknown; launches?: unknown } | null;
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray(asBody?.mints)
        ? asBody.mints
        : Array.isArray(asBody?.launches)
          ? asBody.launches
          : null;
    if (!Array.isArray(rawList)) {
      return { seeds: [], invalid: 0, error: "feed payload is not an array" };
    }
    const { seeds, invalid } = normalizeSeeds(rawList, "remote");
    return { seeds, invalid };
  } catch (e) {
    return {
      seeds: [],
      invalid: 0,
      error: `feed unreachable: ${String((e as Error)?.message || e).slice(0, 80)}`,
    };
  }
}

/**
 * Committed seeds + optional remote feed, deduped (committed wins).
 * `feedUrl` null/empty skips the remote fetch entirely.
 */
export async function loadLaunchSeeds(opts: {
  feedUrl?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{
  seeds: LaunchSeed[];
  remoteUsed: boolean;
  remoteError?: string;
  remoteInvalid: number;
}> {
  const committed = normalizeSeeds(KNOWN_LAUNCH_SEEDS, "committed").seeds;
  const byMint = new Map<string, LaunchSeed>();
  for (const s of committed) byMint.set(s.mint, s);

  let remoteUsed = false;
  let remoteError: string | undefined;
  let remoteInvalid = 0;
  const feedUrl = opts.feedUrl?.trim() || null;
  if (feedUrl) {
    const remote = await fetchRemoteSeeds(feedUrl, {
      fetchImpl: opts.fetchImpl ?? fetch,
      timeoutMs: opts.timeoutMs,
    });
    remoteUsed = true;
    remoteError = remote.error;
    remoteInvalid = remote.invalid;
    for (const s of remote.seeds) {
      if (!byMint.has(s.mint)) byMint.set(s.mint, s);
    }
  }
  return {
    seeds: Array.from(byMint.values()),
    remoteUsed,
    remoteError,
    remoteInvalid,
  };
}