/**
 * Unit tests for web/lib/server/store.ts — the verified-launch registry.
 * Runs against an isolated SPAWNPAD_DATA_DIR (never touches web/.data).
 */
import { expect } from "chai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("store: verified-launch registry", () => {
  let dataDir: string;
  let store: typeof import("../../web/lib/server/store");

  before(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "spawnpad-store-test-"));
    process.env.SPAWNPAD_DATA_DIR = dataDir;
    store = await import("../../web/lib/server/store");
  });

  after(() => {
    delete process.env.SPAWNPAD_DATA_DIR;
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  const rec = (mint: string, status: "verified" | "rejected" | "pending") => ({
    mint,
    signature: "sig-" + mint,
    name: "Token " + mint,
    symbol: "T" + mint.slice(0, 2),
    network: "mainnet-beta",
    launchedAt: Date.now(),
    verifiedAt: status === "verified" ? Date.now() : undefined,
    status,
  });

  it("persists a verified record and deduplicates by mint (no duplicate entries)", () => {
    const mint = "MintAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1Spw";
    store.upsertLaunch(rec(mint, "verified"));
    const first = store.getLaunch(mint);
    expect(first?.status).to.equal("verified");
    // Second submission for the same mint — must not create a duplicate.
    store.upsertLaunch({ ...rec(mint, "verified"), launchedAt: Date.now() + 5 });
    const all = store.listLaunches({}).filter((r) => r.mint === mint);
    expect(all.length).to.equal(1);
  });

  it("never downgrades an already-verified record on a later rejection", () => {
    const mint = "MintBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2Spw";
    store.upsertLaunch(rec(mint, "verified"));
    store.upsertLaunch(rec(mint, "rejected"));
    expect(store.getLaunch(mint)?.status).to.equal("verified");
  });

  it("writes rejected submissions but they are excluded from verified listings", () => {
    const mint = "MintCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC3Spw";
    store.upsertLaunch(rec(mint, "rejected"));
    expect(store.getLaunch(mint)?.status).to.equal("rejected");
    const verified = store.listLaunches({ verifiedOnly: true });
    expect(verified.find((r) => r.mint === mint)).to.equal(undefined);
  });

  it("upgrade path: a rejected record becomes verified after reconciliation", () => {
    const mint = "MintDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD4Spw";
    store.upsertLaunch(rec(mint, "rejected"));
    store.upsertLaunch(rec(mint, "verified"));
    expect(store.getLaunch(mint)?.status).to.equal("verified");
    expect(store.listLaunches({ verifiedOnly: true }).find((r) => r.mint === mint)).to.not.equal(undefined);
  });

  it("listLaunches respects the limit and keeps newest-first order", () => {
    for (let i = 0; i < 5; i++) {
      store.upsertLaunch({
        ...rec(`MintE${i}000000000000000000000000000000000000Spw`, "verified"),
        launchedAt: Date.now() + i,
        verifiedAt: Date.now() + i,
      });
    }
    const page = store.listLaunches({ verifiedOnly: true, limit: 3 });
    expect(page.length).to.equal(3);
    expect(page[0].status).to.equal("verified");
  });

  it("distinguishes genuinely empty from unreadable (registry health)", () => {
    // Missing file → readable, genuinely empty.
    const missingDir = fs.mkdtempSync(path.join(os.tmpdir(), "spawnpad-empty-"));
    const prevDir = process.env.SPAWNPAD_DATA_DIR;
    try {
      process.env.SPAWNPAD_DATA_DIR = missingDir;
      delete require.cache[require.resolve("../../web/lib/server/store")];
      const fresh = require("../../web/lib/server/store") as typeof store;
      expect(fresh.registryHealth()).to.deep.equal({ readable: true, error: null });
      expect(fresh.listLaunches()).to.deep.equal([]);

      // Corrupt file → still returns [] but flags the storage failure.
      fs.writeFileSync(path.join(missingDir, "launches.json"), "{corrupt");
      expect(fresh.listLaunches()).to.deep.equal([]);
      const health = fresh.registryHealth();
      expect(health.readable).to.equal(false);
      expect(health.error).to.be.a("string").that.is.not.empty;
    } finally {
      process.env.SPAWNPAD_DATA_DIR = prevDir ?? dataDir;
      delete require.cache[require.resolve("../../web/lib/server/store")];
      try {
        fs.rmSync(missingDir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  });
});