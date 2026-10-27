/**
 * Phase-5 tests for the durable market registry (web/lib/server/
 * market-store.ts): one entry per mint, duplicate-indexing prevention and
 * persistence across "restarts" (isolated SPAWNPAD_DATA_DIR).
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("market-store: durable indexing registry", () => {
  let dataDir: string;
  let store: typeof import("../../web/lib/server/market-store");
  const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
  const CURVE = "2enJmTCXD8ufP512Nku1kRXWLZ3YstAYjzyGhRrfcz4J";

  before(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "spawnpad-market-test-"));
    process.env.SPAWNPAD_DATA_DIR = dataDir;
    store = await import("../../web/lib/server/market-store");
  });

  after(() => {
    delete process.env.SPAWNPAD_DATA_DIR;
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  function indexedEntry() {
    return {
      mint: MINT,
      indexed: true,
      source: "geckoterminal" as const,
      poolAddress: CURVE,
      poolKind: "pumpfun-curve" as const,
      quoteSymbol: "SOL",
      lastGoodAt: Date.now(),
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
    };
  }

  it("upserts by mint — a second registration never duplicates", () => {
    store.upsertMarketEntry(store.getMarketEntry(MINT) ?? {
      mint: MINT,
      indexed: false,
      source: null,
      poolAddress: null,
      poolKind: null,
      quoteSymbol: null,
      lastGoodAt: null,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
    });
    store.upsertMarketEntry(indexedEntry());
    store.upsertMarketEntry(indexedEntry());
    const all = store.listMarketEntries().filter((e) => e.mint === MINT);
    expect(all.length).to.equal(1);
    expect(store.isMarketReady(MINT)).to.equal(true);
  });

  it("persists across a simulated restart (fresh module reads the same dir)", async () => {
    delete require.cache[require.resolve("../../web/lib/server/market-store")];
    const reopened = (await import("../../web/lib/server/market-store")) as typeof store;
    const entry = reopened.getMarketEntry(MINT);
    expect(entry?.indexed).to.equal(true);
    expect(entry?.poolAddress).to.equal(CURVE);
    expect(entry?.poolKind).to.equal("pumpfun-curve");
  });

  it("reports unknown mints as not ready (no fabricated state)", () => {
    expect(store.getMarketEntry("UnknownMint0000000000000000000000000000000Spw")).to.equal(undefined);
    expect(store.isMarketReady("UnknownMint0000000000000000000000000000000Spw")).to.equal(false);
  });

  it("keeps last-good summaries for provider outages", () => {
    store.upsertMarketEntry({
      ...indexedEntry(),
      lastGoodSummary: { mint: MINT, status: "indexed", priceUsd: 0.000002804017615 },
    });
    const entry = store.getMarketEntry(MINT);
    expect((entry?.lastGoodSummary as { priceUsd?: number })?.priceUsd).to.be.closeTo(
      0.000002804017615,
      1e-18
    );
  });
});