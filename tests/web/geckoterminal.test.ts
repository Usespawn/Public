/**
 * Phase-5 tests for the GeckoTerminal provider adapter: pool mapping (with
 * the REAL live pool shape of the test token), genuine OHLCV parsing, and
 * client behavior on 404 / 429 / malformed / success.
 */
import { expect } from "chai";
import {
  createGeckoTerminalClient,
  GeckoTerminalError,
  mapGeckoPools,
  mapGraduation,
  mapPoolStats,
  parseOhlcvList,
} from "../../web/lib/market/providers/geckoterminal";
import { UpstreamRateLimitedError } from "../../web/lib/market/cache";

const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const CURVE = "2enJmTCXD8ufP512Nku1kRXWLZ3YstAYjzyGhRrfcz4J";

/** Trimmed REAL payload observed live for the test token's bonding curve. */
const REAL_POOL_PAYLOAD = {
  data: [
    {
      id: "solana_" + CURVE,
      type: "pool",
      attributes: {
        address: CURVE,
        name: "TST / SOL",
        pool_created_at: "2026-10-26T03:24:45Z",
        base_token_price_usd: "0.000002804017615",
        token_price_usd: "0.000002804017615",
        fdv_usd: "2804.017615",
        price_change_percentage: { m5: "0", h1: "0", h24: "0" },
        transactions: { h24: { buys: 0, sells: 0 } },
        volume_usd: { h24: "0.0" },
        reserve_in_usd: "2227.121",
        launchpad_details: {
          graduation_percentage: 0,
          completed: false,
          completed_at: null,
          migrated_destination_pool_address: null,
        },
      },
      relationships: {
        base_token: { data: { id: "solana_" + MINT } },
        quote_token: { data: { id: "solana_So11111111111111111111111111111111111111112" } },
        dex: { data: { id: "solana_pumpfun" } },
      },
    },
  ],
};

describe("geckoterminal: mapping", () => {
  it("maps the REAL bonding-curve pool with pumpfun classification", () => {
    const pools = mapGeckoPools(REAL_POOL_PAYLOAD);
    expect(pools.length).to.equal(1);
    expect(pools[0].address).to.equal(CURVE);
    expect(pools[0].kind).to.equal("pumpfun-curve");
    expect(pools[0].baseTokenAddress).to.equal(MINT);
    expect(pools[0].quoteTokenSymbol).to.equal("SOL");
    expect(pools[0].reserveUsd).to.be.closeTo(2227.121, 0.001);
  });

  it("classifies non-pumpfun dexes as DEX pools (graduation case)", () => {
    const payload = JSON.parse(JSON.stringify(REAL_POOL_PAYLOAD));
    payload.data[0].relationships.dex.data.id = "solana_pumpswap";
    const pools = mapGeckoPools(payload);
    expect(pools[0].kind).to.equal("dex-pool");
  });

  it("extracts REAL graduation state (curve not completed, no migration)", () => {
    const g = mapGraduation(REAL_POOL_PAYLOAD);
    expect(g?.completed).to.equal(false);
    expect(g?.percentage).to.equal(0);
    expect(g?.migratedPoolAddress).to.equal(null);
  });

  it("extracts stats (price, volume, liquidity, txns) as numbers", () => {
    const s = mapPoolStats(REAL_POOL_PAYLOAD);
    expect(s.priceUsd).to.be.closeTo(0.000002804017615, 1e-15);
    expect(s.liquidityUsd).to.be.closeTo(2227.121, 0.001);
    expect(s.volume24hUsd).to.equal(0);
    expect(s.txns24h).to.deep.equal({ buys: 0, sells: 0 });
  });

  it("throws malformed on payloads without data[]", () => {
    expect(() => mapGeckoPools({ error: "boom" })).to.throw(GeckoTerminalError);
  });
});

describe("geckoterminal: genuine OHLCV parsing", () => {
  it("reverses newest-first olhcv_list into oldest-first candles", () => {
    const payload = {
      data: {
        attributes: {
          ohlcv_list: [
            [1700000300, 2, 3, 1, 2.5, 111],
            [1700000000, 1, 2, 0.5, 2, 100],
          ],
        },
      },
    };
    const candles = parseOhlcvList(payload);
    expect(candles.length).to.equal(2);
    expect(candles[0].time).to.equal(1700000000); // oldest first
    expect(candles[0].open).to.equal(1);
    expect(candles[1].close).to.equal(2.5);
    expect(candles[1].volume).to.equal(111);
  });

  it("keeps candles with null volume but drops broken rows", () => {
    const payload = {
      data: {
        attributes: {
          ohlcv_list: [
            [1, 1, 1, 1, 1],
            [2, 2, 2, 2, 2, null],
            [3, null, 1, 1, 1, 5],
          ],
        },
      },
    };
    const candles = parseOhlcvList(payload);
    expect(candles.length).to.equal(2);
    expect(candles[0].volume).to.equal(null);
  });

  it("throws malformed when ohlcv_list is missing (never fabricates)", () => {
    expect(() => parseOhlcvList({ data: { attributes: {} } })).to.throw(GeckoTerminalError);
  });
});
describe("geckoterminal: client behavior", () => {
  function clientWith(handler: (path: string) => Response) {
    return createGeckoTerminalClient({
      fetchImpl: (async (input: string) =>
        handler(String(input).replace(/^https:\/\/[^/]+/, ""))) as unknown as typeof fetch,
    });
  }

  it("returns [] on 404 (token not indexed yet — not an error)", async () => {
    const client = clientWith(() => new Response("{}", { status: 404 }));
    const pools = await client.tokenPools(MINT);
    expect(pools).to.deep.equal([]);
  });

  it("maps a successful pools request", async () => {
    const client = clientWith(
      () =>
        new Response(JSON.stringify(REAL_POOL_PAYLOAD), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    const pools = await client.tokenPools(MINT);
    expect(pools.length).to.equal(1);
    expect(pools[0].address).to.equal(CURVE);
  });

  it("converts 429 into UpstreamRateLimitedError with retry-after", async () => {
    const client = clientWith(
      () => new Response("{}", { status: 429, headers: { "retry-after": "30" } })
    );
    try {
      await client.poolDetail(CURVE);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).to.be.instanceOf(UpstreamRateLimitedError);
      expect((e as UpstreamRateLimitedError).retryAfterMs).to.equal(30_000);
    }
  });

  it("flags malformed JSON bodies", async () => {
    const client = clientWith(
      () =>
        new Response("{broken", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    try {
      await client.poolDetail(CURVE);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as GeckoTerminalError).kind).to.equal("malformed");
    }
  });

  it("reports network failure as unavailable", async () => {
    const client = createGeckoTerminalClient({
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    try {
      await client.tokenPools(MINT);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as GeckoTerminalError).kind).to.equal("unavailable");
    }
  });

  it("requests OHLCV with the documented timeframe/aggregate params", async () => {
    let requested = "";
    const client = createGeckoTerminalClient({
      fetchImpl: (async (input: string) => {
        requested = String(input);
        return new Response(JSON.stringify({ data: { attributes: { ohlcv_list: [] } } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch,
    });
    const candles = await client.ohlcv(CURVE, { timeframe: "minute", aggregate: 15, limit: 24 });
    expect(candles).to.deep.equal([]);
    expect(requested).to.contain("/ohlcv/minute?");
    expect(requested).to.contain("aggregate=15");
    expect(requested).to.contain("limit=24");
  });
});