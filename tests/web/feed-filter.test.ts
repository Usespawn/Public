/**
 * Unit tests for web/lib/launch/feed-filter.ts — the pure listing rules used
 * by New launches / Trending / Explore.
 */
import { expect } from "chai";
import { filterLaunchRecords, type FeedRecord } from "../../web/lib/launch/feed-filter";

const MINT_A = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const MINT_B = "Gh9ZwEmdLJ8DvK7aqVZ4pVCPbBKE9y8d spontaneousSpw";
const MINT_C = "Ct7pFvVmfXmK6XsGm2mLmBnYsrq2zspwREJECTEDMINTSpw";

function rec(mint: string, name: string, symbol: string, status: string, verifiedAt: number): FeedRecord {
  return { mint, signature: `sig-${mint}`, name, symbol, status, verifiedAt, launchedAt: verifiedAt - 1000 };
}

const now = 1_700_000_000_000;
const feed: FeedRecord[] = [
  rec(MINT_A, "Test Token", "TST", "verified", now),
  rec(MINT_B, "Older Verified", "OLD", "verified", now - 60_000),
  rec(MINT_C, "Rejected One", "REJ", "rejected", now - 30_000),
  rec("PendingMint0000000000000000000000000000000000000Spw", "Pending One", "PND", "pending", now - 10_000),
];

describe("feed-filter: verified-only listing", () => {
  it("excludes pending and rejected records when verifiedOnly", () => {
    const out = filterLaunchRecords(feed, { verifiedOnly: true });
    expect(out.length).to.be.greaterThan(0);
    expect(out.every((r) => r.status === "verified")).to.equal(true);
    expect(out.find((r) => r.mint === MINT_C)).to.equal(undefined);
  });

  it("keeps every record when verifiedOnly is false", () => {
    const out = filterLaunchRecords(feed, { verifiedOnly: false });
    expect(out.length).to.equal(4);
  });
});

describe("feed-filter: tabs", () => {
  it("live and graduated tabs show verified launches only", () => {
    for (const tab of ["live", "graduated"] as const) {
      const out = filterLaunchRecords(feed, { tab, verifiedOnly: true });
      expect(out.length).to.be.greaterThan(0);
      expect(out.every((r) => r.status === "verified")).to.equal(true);
    }
  });

  it("the all tab shows every verified record, newest first", () => {
    const out = filterLaunchRecords(feed, { tab: "all", verifiedOnly: true });
    expect(out[0].mint).to.equal(MINT_A); // newest verified
    expect(out[1].mint).to.equal(MINT_B);
  });

  it("sorts by verifiedAt descending so a just-verified launch is first", () => {
    const shuffled: FeedRecord[] = [
      rec(MINT_B, "Older Verified", "OLD", "verified", now - 60_000),
      rec(MINT_A, "Test Token", "TST", "verified", now),
    ];
    const out = filterLaunchRecords(shuffled, { verifiedOnly: true });
    expect(out[0].mint).to.equal(MINT_A);
  });
});

describe("feed-filter: search", () => {
  it("matches name, symbol or mint case-insensitively", () => {
    expect(filterLaunchRecords(feed, { verifiedOnly: true, query: "test" }).map((r) => r.mint)).to.deep.equal([MINT_A]);
    expect(filterLaunchRecords(feed, { verifiedOnly: true, query: "tst" }).map((r) => r.mint)).to.deep.equal([MINT_A]);
    expect(filterLaunchRecords(feed, { verifiedOnly: true, query: MINT_A.toLowerCase() }).map((r) => r.mint)).to.deep.equal([MINT_A]);
    expect(filterLaunchRecords(feed, { verifiedOnly: true, query: "zzz" }).length).to.equal(0);
  });
});

describe("feed-filter: pagination safety", () => {
  it("applies limit AFTER filtering so new tokens are never pushed out", () => {
    const many: FeedRecord[] = [];
    for (let i = 0; i < 150; i++) {
      many.push(rec(`Mint${String(i).padStart(4, "0")}000000000000000000000000000000000Spw`, `Token ${i}`, `T${i}`, "verified", now - i * 1000));
    }
    // The just-verified newest token must survive a tight page limit.
    many[0] = rec(MINT_A, "Fresh Launch", "FRSH", "verified", now);
    const page1 = filterLaunchRecords(many, { verifiedOnly: true, limit: 100 });
    expect(page1.length).to.equal(100);
    expect(page1[0].mint).to.equal(MINT_A);
    // And a search-limited result also respects the cap.
    const search = filterLaunchRecords(many, { verifiedOnly: true, query: "token 1", limit: 10 });
    expect(search.length).to.be.at.most(10);
  });

  it("never returns records when the store is empty", () => {
    expect(filterLaunchRecords([], { verifiedOnly: true, tab: "all" })).to.deep.equal([]);
  });
});