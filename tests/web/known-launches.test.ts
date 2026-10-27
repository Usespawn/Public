/**
 * Regression tests for the production-empty-Explore fix: the committed seed
 * registry (known-launches) that ships with every deployment.
 */
import { expect } from "chai";
import {
  KNOWN_LAUNCH_SEEDS,
  fetchRemoteSeeds,
  loadLaunchSeeds,
  normalizeSeeds,
  parseSeedEntry,
} from "../../web/lib/server/known-launches";

const REAL_MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const REAL_SIG =
  "573GqJL6Y7GrMhM4No7xD73w4CzSLFmXASexD56cBWakAfxyD1Qb4rqEjK5fKdjWyeWgxvMN2aTnrsgJhikeHbFY";

describe("known-launches: committed seeds", () => {
  it("ships the real test-token launch (mint + signature)", () => {
    const seed = KNOWN_LAUNCH_SEEDS.find((s) => s.mint === REAL_MINT);
    expect(seed).to.not.equal(undefined);
    expect(seed!.signature).to.equal(REAL_SIG);
    expect(seed!.network).to.equal("mainnet-beta");
  });

  it("validates entries and enforces the exact case-sensitive Spw suffix", () => {
    expect(parseSeedEntry({ mint: REAL_MINT }, "remote")?.mint).to.equal(REAL_MINT);
    // lowercase spw rejected (case-sensitive contract)
    expect(parseSeedEntry({ mint: REAL_MINT.slice(0, -3) + "spw" }, "remote")).to.equal(null);
    expect(parseSeedEntry({ mint: "TooShortSpw" }, "remote")).to.equal(null);
    expect(parseSeedEntry({ mint: REAL_MINT, signature: "not-base58!!" }, "remote")).to.equal(null);
    expect(parseSeedEntry("junk", "remote")).to.equal(null);
    expect(parseSeedEntry(null, "remote")).to.equal(null);
  });

  it("normalizeSeeds dedupes by mint and counts invalid entries", () => {
    const { seeds, invalid } = normalizeSeeds(
      [REAL_MINT, REAL_MINT, { mint: REAL_MINT.slice(0, -3) + "spw" }, "junk"],
      "remote"
    );
    expect(seeds.length).to.equal(1);
    expect(invalid).to.equal(3);
  });
});

describe("known-launches: optional remote feed", () => {
  it("accepts mint-string arrays and object arrays", async () => {
    const fetchImpl = (async (url: string) => {
      const body = String(url).includes("objects")
        ? [{ mint: REAL_MINT, signature: REAL_SIG, name: "test", symbol: "TST" }]
        : [REAL_MINT];
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;

    const asStrings = await fetchRemoteSeeds("https://feed.test/strings", { fetchImpl });
    expect(asStrings.seeds.length).to.equal(1);
    expect(asStrings.seeds[0].mint).to.equal(REAL_MINT);
    const asObjects = await fetchRemoteSeeds("https://feed.test/objects", { fetchImpl });
    expect(asObjects.seeds[0].signature).to.equal(REAL_SIG);
  });

  it("drops invalid remote entries instead of failing", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify([REAL_MINT, "NotAValidMint", REAL_MINT.slice(0, -3) + "spw"]),
        { status: 200 }
      )) as unknown as typeof fetch;
    const out = await fetchRemoteSeeds("https://feed.test/x", { fetchImpl });
    expect(out.seeds.length).to.equal(1);
    expect(out.invalid).to.equal(2);
  });

  it("reports feed failures explicitly (HTTP 500 / non-JSON / unreachable)", async () => {
    const e500 = await fetchRemoteSeeds("https://feed.test/x", {
      fetchImpl: (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch,
    });
    expect(e500.error).to.contain("HTTP 500");
    const eBad = await fetchRemoteSeeds("https://feed.test/x", {
      fetchImpl: (async () =>
        new Response("not json", { status: 200 })) as unknown as typeof fetch,
    });
    expect(eBad.error).to.contain("non-JSON");
    const eNet = await fetchRemoteSeeds("https://feed.test/x", {
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    expect(eNet.error).to.contain("unreachable");
  });

  it("loadLaunchSeeds merges remote under committed (committed wins) and skips when no feed", async () => {
    const merged = await loadLaunchSeeds({
      feedUrl: "https://feed.test/x",
      fetchImpl: (async () =>
        new Response(JSON.stringify([REAL_MINT, "MintZ" + "1".repeat(35) + "Spw"]), {
          status: 200,
        })) as unknown as typeof fetch,
    });
    expect(merged.seeds.length).to.equal(2); // committed test token + remote extra
    expect(merged.seeds.find((s) => s.mint === REAL_MINT)?.origin).to.equal("committed");
    expect(merged.remoteUsed).to.equal(true);

    const none = await loadLaunchSeeds({ feedUrl: null });
    expect(none.remoteUsed).to.equal(false);
    expect(none.seeds.length).to.equal(1);
    expect(none.seeds[0].mint).to.equal(REAL_MINT);
  });
});