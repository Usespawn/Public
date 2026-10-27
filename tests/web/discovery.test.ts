/**
 * Phase-5 tests for market discovery planning (bounded retries, restart-safe
 * backoff) and pool selection (bonding-curve vs DEX pool, multiple pools).
 */
import { expect } from "chai";
import {
  createRegistryEntry,
  DISCOVERY_MAX_RETRIES,
  recordDiscoveryHit,
  recordDiscoveryMiss,
  shouldDiscover,
  type MarketRegistryEntry,
} from "../../web/lib/market/discovery";
import { pickBestPool, type PoolInfo } from "../../web/lib/market/types";

const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const CURVE = "2enJmTCXD8ufP512Nku1kRXWLZ3YstAYjzyGhRrfcz4J";

function pool(address: string, reserveUsd: number | null, base = MINT): PoolInfo {
  return {
    address,
    kind: "pumpfun-curve",
    dexId: "pumpfun",
    name: "TST / SOL",
    baseTokenAddress: base,
    quoteTokenAddress: "So11111111111111111111111111111111111111112",
    quoteTokenSymbol: "SOL",
    reserveUsd,
    poolCreatedAt: null,
  };
}

describe("discovery: bounded, restart-safe scheduling", () => {
  it("allows the first attempt for an unseen mint", () => {
    expect(shouldDiscover(undefined, 1_000)).to.equal(true);
  });

  it("schedules exponential backoff after a miss (30s → 60s → …)", () => {
    let entry = createRegistryEntry(MINT);
    entry = recordDiscoveryMiss(entry, 1_000, "no indexed pool yet");
    expect(entry.retryCount).to.equal(1);
    expect(entry.nextRetryAt).to.equal(1_000 + 30_000);
    expect(shouldDiscover(entry, 1_000 + 29_000)).to.equal(false);
    expect(shouldDiscover(entry, 1_000 + 30_000)).to.equal(true);
    entry = recordDiscoveryMiss(entry, 31_000, "no indexed pool yet");
    expect(entry.nextRetryAt).to.equal(31_000 + 60_000);
  });

  it("stops retrying after the bound (never hammers a provider)", () => {
    let entry: MarketRegistryEntry = createRegistryEntry(MINT);
    for (let i = 0; i < DISCOVERY_MAX_RETRIES + 3; i++) {
      entry = recordDiscoveryMiss(entry, i * 1_000_000, "no indexed pool yet");
    }
    expect(entry.retryCount).to.equal(DISCOVERY_MAX_RETRIES);
    expect(shouldDiscover(entry, Date.now() + 10_000_000)).to.equal(false);
  });

  it("an indexed mint never re-runs discovery (summary TTL handles refresh)", () => {
    const hit = recordDiscoveryHit(createRegistryEntry(MINT), {
      source: "geckoterminal",
      poolAddress: CURVE,
      poolKind: "pumpfun-curve",
      quoteSymbol: "SOL",
      now: 5_000,
    });
    expect(hit.indexed).to.equal(true);
    expect(shouldDiscover(hit, 999_999_999)).to.equal(false);
  });

  it("a discovery hit resets retry bookkeeping", () => {
    let entry = createRegistryEntry(MINT);
    entry = recordDiscoveryMiss(entry, 1_000, "no indexed pool yet");
    entry = recordDiscoveryMiss(entry, 2_000, "no indexed pool yet");
    const hit = recordDiscoveryHit(entry, {
      source: "geckoterminal",
      poolAddress: CURVE,
      poolKind: "pumpfun-curve",
      quoteSymbol: "SOL",
      now: 3_000,
    });
    expect(hit.retryCount).to.equal(0);
    expect(hit.nextRetryAt).to.equal(null);
    expect(hit.lastError).to.equal(null);
  });
});

describe("pool selection: curve vs DEX pools, multiple pools", () => {
  it("picks the deepest-liquidity pool trading the mint as base", () => {
    const pools = [
      pool("small", 100),
      pool("big", 5_000),
      pool("mid", 1_000),
    ];
    const best = pickBestPool(pools, MINT);
    expect(best?.address).to.equal("big");
  });

  it("ignores pools whose base token is a different mint", () => {
    const pools = [pool("other", 99_999, "SomeOtherMint0000000000000000000000000000000Spw")];
    expect(pickBestPool(pools, MINT)).to.equal(null);
  });

  it("handles graduated tokens: a DEX pool with deeper liquidity wins over the curve", () => {
    const curve = { ...pool(CURVE, 2_200), kind: "pumpfun-curve" as const };
    const graduated = {
      ...pool("graduated-pool", 45_000),
      kind: "dex-pool" as const,
      dexId: "pumpswap",
    };
    const best = pickBestPool([curve, graduated], MINT);
    expect(best?.address).to.equal("graduated-pool");
    expect(best?.kind).to.equal("dex-pool");
  });

  it("prefers pools with known liquidity over unknown ones", () => {
    const unknown = pool("unknown", null);
    const known = pool("known", 10);
    expect(pickBestPool([unknown, known], MINT)?.address).to.equal("known");
  });
});