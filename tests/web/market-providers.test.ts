/**
 * Phase-5 tests for the DexScreener secondary provider and the on-chain
 * Pump.fun bonding-curve price fallback (curve vs graduated-pool handling).
 */
import { expect } from "chai";
import {
  createDexScreenerClient,
  DexScreenerError,
  mapBestPairStats,
  mapDexPairs,
} from "../../web/lib/market/providers/dexscreener";
import { decodeBondingCurveState, curvePriceUsd } from "../../web/lib/market/pump-curve";
import { CANDLE_RANGES, parseRangeLabel, formatUsdPrice } from "../../web/lib/market/types";
import { UpstreamRateLimitedError } from "../../web/lib/market/cache";

const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";

describe("dexscreener: pair mapping", () => {
  it("maps pairs to DEX pools (never as bonding curves)", () => {
    const pairs = {
      pairs: [
        {
          chainId: "solana",
          dexId: "raydium",
          pairAddress: "PairAddr1111111111111111111111111111111111",
          baseToken: { address: MINT, symbol: "TST", name: "test" },
          quoteToken: { address: "So11111111111111111111111111111111111111112", symbol: "SOL" },
          priceUsd: "0.0000029",
          priceChange: { h24: 3.21 },
          volume: { h24: 1200.5 },
          liquidity: { usd: 25000 },
          pairCreatedAt: 1700000000000,
        },
      ],
    };
    const pools = mapDexPairs(pairs);
    expect(pools.length).to.equal(1);
    expect(pools[0].kind).to.equal("dex-pool");
    expect(pools[0].dexId).to.equal("raydium");
    expect(pools[0].reserveUsd).to.equal(25000);
  });

  it("handles null pairs (not indexed) and malformed payloads distinctly", () => {
    expect(mapDexPairs({ pairs: null })).to.deep.equal([]);
    expect(() => mapDexPairs({ pairs: { not: "an array" } })).to.throw(DexScreenerError);
  });

  it("picks the deepest pair for stats and validates the icon", () => {
    const payload = {
      pairs: [
        {
          pairAddress: "p1",
          baseToken: { address: MINT },
          priceUsd: "0.0000029",
          priceChange: { h24: 3.21 },
          volume: { h24: 100 },
          liquidity: { usd: 1000 },
          txns: { h24: { buys: 5, sells: 2 } },
        },
        {
          pairAddress: "p2",
          baseToken: { address: MINT },
          priceUsd: "0.0000030",
          volume: { h24: 50 },
          liquidity: { usd: 90000 },
          info: { imageUrl: "javascript:alert(1)" },
        },
      ],
    };
    const stats = mapBestPairStats(payload, MINT);
    expect(stats?.liquidityUsd).to.equal(90000);
    expect(stats?.iconUrl).to.equal(null); // unsafe icon never surfaces
    // The best pair reports no txn counters → honest null (never 0-invented).
    expect(stats?.txns24h).to.equal(null);
  });

  it("returns null when no pair matches the mint", () => {
    expect(mapBestPairStats({ pairs: [] }, MINT)).to.equal(null);
  });
});

describe("dexscreener: client behavior", () => {
  it("converts 429 into UpstreamRateLimitedError (shared contract)", async () => {
    const client = createDexScreenerClient({
      fetchImpl: (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch,
    });
    try {
      await client.bestPairStats(MINT);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).to.be.instanceOf(UpstreamRateLimitedError);
    }
  });

  it("returns [] on 404", async () => {
    const client = createDexScreenerClient({
      fetchImpl: (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch,
    });
    expect(await client.tokenPairs(MINT)).to.deep.equal([]);
  });
});
describe("pump-curve: real on-chain bonding-curve decoding", () => {
  function curveBytes(opts: {
    virtualToken: bigint;
    virtualSol: bigint;
    complete: boolean;
  }): Uint8Array {
    const buf = new Uint8Array(49);
    const view = new DataView(buf.buffer);
    view.setBigUint64(8, opts.virtualToken, true);
    view.setBigUint64(16, opts.virtualSol, true);
    buf[48] = opts.complete ? 1 : 0;
    return buf;
  }

  it("derives priceSOL from virtual reserves (0.42 SOL / 1M tokens)", () => {
    // 1,000,000 tokens (1e6 raw * 1e6 decimals) for 0.42 SOL:
    // price per single token = 0.42 SOL / 1e6 tokens = 4.2e-7 SOL.
    const state = decodeBondingCurveState(
      curveBytes({ virtualToken: 1_000_000_000_000n, virtualSol: 420_000_000n, complete: false })
    );
    expect(state.exists).to.equal(true);
    expect(state.complete).to.equal(false);
    expect(state.priceSOL).to.be.closeTo(4.2e-7, 1e-12);
  });

  it("marks completed curves (graduated) without touching pool data", () => {
    const state = decodeBondingCurveState(
      curveBytes({ virtualToken: 1n, virtualSol: 1n, complete: true })
    );
    expect(state.complete).to.equal(true);
  });

  it("reports non-existent curves honestly", () => {
    const state = decodeBondingCurveState(null);
    expect(state.exists).to.equal(false);
    expect(state.priceSOL).to.equal(null);
  });

  it("converts to USD only with a REAL SOL/USD quote (never fabricated)", () => {
    expect(curvePriceUsd(0.42, 100)).to.be.closeTo(42, 1e-9);
    expect(curvePriceUsd(0.42, null)).to.equal(null); // no quote → no USD price
    expect(curvePriceUsd(null, 100)).to.equal(null);
  });
});

describe("candle ranges: provider-supported mapping only", () => {
  it("maps every UI range to a genuine GeckoTerminal granularity", () => {
    for (const [, plan] of Object.entries(CANDLE_RANGES)) {
      expect(["minute", "hour", "day"]).to.include(plan.timeframe);
      if (plan.timeframe === "minute") {
        expect([1, 5, 15]).to.include(plan.aggregate);
      }
      expect(plan.limit).to.be.greaterThan(0);
    }
    expect(CANDLE_RANGES["5m"].limit).to.equal(6);
    expect(CANDLE_RANGES["30d"].timeframe).to.equal("day");
  });

  it("parses and rejects range labels strictly", () => {
    expect(parseRangeLabel("24h")).to.equal("24h");
    expect(parseRangeLabel("1y")).to.equal(null);
    expect(parseRangeLabel(undefined)).to.equal(null);
  });

  it("formats tiny real prices without inventing precision", () => {
    expect(formatUsdPrice(0.000002804017615)).to.match(/^\$0\.00000280/);
    expect(formatUsdPrice(null)).to.equal("—");
    expect(formatUsdPrice(1.5)).to.equal("$1.5000");
  });
});