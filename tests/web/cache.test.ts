/**
 * Phase-5 tests for the TTL cache, single-flight dedup and upstream rate
 * budget that guard every market-data provider call.
 */
import { expect } from "chai";
import {
  createRateBudget,
  createTtlCache,
  UpstreamRateLimitedError,
} from "../../web/lib/market/cache";

describe("cache: TTL + single-flight", () => {
  it("serves fresh values without re-fetching and refetches after expiry", async () => {
    let now = 1_000_000;
    const clock = () => now;
    const cache = createTtlCache<string>({ now: clock });
    let loads = 0;
    const entry1 = await cache.fetchThrough("k", 10_000, async () => {
      loads++;
      return "v1";
    });
    const entry2 = await cache.fetchThrough("k", 10_000, async () => {
      loads++;
      return "v2";
    });
    expect(loads).to.equal(1); // TTL hit
    expect(entry1.value).to.equal("v1");
    expect(entry2.value).to.equal("v1");
    now += 10_001; // expired
    const entry3 = await cache.fetchThrough("k", 10_000, async () => {
      loads++;
      return "v3";
    });
    expect(loads).to.equal(2);
    expect(entry3.value).to.equal("v3");
  });

  it("deduplicates concurrent loaders into one upstream call", async () => {
    const cache = createTtlCache<string>();
    let loads = 0;
    const loader = async () => {
      loads++;
      await new Promise((r) => setTimeout(r, 5));
      return "shared";
    };
    const [a, b, c] = await Promise.all([
      cache.fetchThrough("k", 10_000, loader),
      cache.fetchThrough("k", 10_000, loader),
      cache.fetchThrough("k", 10_000, loader),
    ]);
    expect(loads).to.equal(1);
    expect(a.value).to.equal("shared");
    expect(b.value).to.equal("shared");
    expect(c.value).to.equal("shared");
  });

  it("caches 429 cooldowns so a hot error cannot become a request per visitor", async () => {
    let now = 5_000_000;
    const clock = () => now;
    const cache = createTtlCache<string>({ now: clock });
    let loads = 0;
    const failing = async () => {
      loads++;
      throw new UpstreamRateLimitedError(60_000);
    };
    await cache.fetchThrough("k", 10_000, failing).catch(() => undefined);
    await cache.fetchThrough("k", 10_000, failing).catch(() => undefined);
    await cache.fetchThrough("k", 10_000, failing).catch(() => undefined);
    // Cooldown entry prevents refetching until it expires.
    expect(loads).to.equal(1);
    now += 60_001;
    await cache.fetchThrough("k", 10_000, failing).catch(() => undefined);
    expect(loads).to.equal(2);
  });
});

describe("cache: upstream rate budget", () => {
  it("enforces the per-minute cap and rolls the window", () => {
    let now = 10_000_000;
    const clock = () => now;
    const budget = createRateBudget(3, { now: clock });
    expect(budget.tryConsume()).to.equal(true);
    expect(budget.tryConsume()).to.equal(true);
    expect(budget.tryConsume()).to.equal(true);
    expect(budget.tryConsume()).to.equal(false); // exhausted
    expect(budget.usedThisMinute()).to.equal(3);
    now += 60_001; // window rolled
    expect(budget.tryConsume()).to.equal(true);
  });

  it("keeps the limit independent of the caller", () => {
    const budget = createRateBudget(1);
    expect(budget.limitPerMinute()).to.equal(1);
    expect(budget.tryConsume()).to.equal(true);
    expect(budget.tryConsume()).to.equal(false);
  });
});