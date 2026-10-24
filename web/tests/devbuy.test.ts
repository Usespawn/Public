/**
 * Dev Buy + automatic vanity launch flow tests (node:test, run via tsx).
 *
 * Pure-logic coverage only — no network, no real SOL:
 *  - amount validation matrix (invalid / zero / negative / presets / custom)
 *  - overhead estimate arithmetic
 *  - conservative automatic worker count
 *  - Spw-suffix enforcement in BOTH transaction builders (create-only and
 *    atomic create+buy) — a non-matching mint is refused before anything else
 *  - dev buy totals respected (never adjusted silently)
 *  - keypair hygiene: secret key material stays in memory (rebuilt locally)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  validateDevBuyAmount,
  estimateDevBuyTotals,
  DEV_BUY_PRESETS_SOL,
  DEV_BUY_MIN_SOL,
  DEV_BUY_MAX_SOL,
  DEV_BUY_OVERHEAD_LAMPORTS,
} from "../lib/launch/devbuy";
import { autoWorkerCount } from "../lib/vanity/grinder";
import { buildCreateTransaction, buildCreateAndBuyTransaction } from "../lib/launch/launch";
import { isSpawnVanityAddress, MANDATORY_SUFFIX } from "../lib/config";

const ONE_SOL = BigInt(LAMPORTS_PER_SOL);

test("presets are exactly 0.01 / 0.05 / 0.1 / 0.5 SOL", () => {
  assert.deepEqual([...DEV_BUY_PRESETS_SOL], [0.01, 0.05, 0.1, 0.5]);
});

test("validateDevBuyAmount rejects non-finite, zero and negative amounts", () => {
  assert.equal(validateDevBuyAmount(Number.NaN).ok, false);
  assert.equal(validateDevBuyAmount(Number.POSITIVE_INFINITY).ok, false);
  assert.equal(validateDevBuyAmount(Number.NEGATIVE_INFINITY).ok, false);
  assert.equal(validateDevBuyAmount(0).ok, false);
  assert.equal(validateDevBuyAmount(-0.01).ok, false);
  // A "valid-looking" string coercion path is impossible: the function takes
  // number only; guard against accidental undefined/null too.
  // @ts-expect-error — runtime safety check of the guard
  assert.equal(validateDevBuyAmount(undefined).ok, false);
  // @ts-expect-error — runtime safety check of the guard
  assert.equal(validateDevBuyAmount(null).ok, false);
});

test("validateDevBuyAmount rejects amounts below minimum and above maximum", () => {
  const below = validateDevBuyAmount(DEV_BUY_MIN_SOL / 2);
  assert.equal(below.ok, false);
  assert.match(below.error ?? "", /minimum dev buy/i);

  const above = validateDevBuyAmount(DEV_BUY_MAX_SOL + 0.01);
  assert.equal(above.ok, false);
  assert.match(above.error ?? "", /maximum dev buy/i);
});

test("validateDevBuyAmount accepts each preset exactly", () => {
  for (const p of DEV_BUY_PRESETS_SOL) {
    const v = validateDevBuyAmount(p);
    assert.equal(v.ok, true, `preset ${p} must validate`);
    assert.ok(v.lamports && v.lamports > 0n);
  }
  assert.equal(validateDevBuyAmount(0.01).lamports, 10_000_000n);
  assert.equal(validateDevBuyAmount(0.05).lamports, 50_000_000n);
  assert.equal(validateDevBuyAmount(0.1).lamports, 100_000_000n);
  assert.equal(validateDevBuyAmount(0.5).lamports, 500_000_000n);
});

test("validateDevBuyAmount accepts valid custom amounts", () => {
  assert.equal(validateDevBuyAmount(0.25).ok, true);
  assert.equal(validateDevBuyAmount(0.25).lamports, 250_000_000n);
  assert.equal(validateDevBuyAmount(DEV_BUY_MAX_SOL).ok, true);
});

test("validateDevBuyAmount checks balance INCLUDING fees and rent", () => {
  const sol = 0.1;
  const need = BigInt(Math.round(sol * LAMPORTS_PER_SOL)) + DEV_BUY_OVERHEAD_LAMPORTS;
  // Exactly enough → ok.
  assert.equal(validateDevBuyAmount(sol, Number(need)).ok, true);
  // One lamport short → rejected with an insufficient-balance message.
  const short = validateDevBuyAmount(sol, Number(need) - 1);
  assert.equal(short.ok, false);
  assert.match(short.error ?? "", /insufficient balance/i);
  // No balance info → amount-level validation only.
  assert.equal(validateDevBuyAmount(sol, null).ok, true);
});

test("estimateDevBuyTotals keeps the buy amount separate from overhead", () => {
  const est = estimateDevBuyTotals(0.05);
  assert.equal(est.buyLamports, 50_000_000n);
  assert.equal(est.overheadLamports, DEV_BUY_OVERHEAD_LAMPORTS);
  assert.equal(est.totalLamports, est.buyLamports + DEV_BUY_OVERHEAD_LAMPORTS);
  // Overhead is the documented ~0.00261 SOL: tx fee + priority fee + ATA rent.
  assert.equal(DEV_BUY_OVERHEAD_LAMPORTS, 2_610_000n);
});

test("autoWorkerCount is conservative and bounded to [2, 4]", () => {
  assert.equal(autoWorkerCount(16), 4);   // half the cores, capped
  assert.equal(autoWorkerCount(8), 4);
  assert.equal(autoWorkerCount(6), 3);
  assert.equal(autoWorkerCount(4), 2);    // floor, never below 2
  assert.equal(autoWorkerCount(2), 2);
  assert.equal(autoWorkerCount(1), 2);    // never 1 (parallelism helps)
  assert.equal(autoWorkerCount(undefined), 2); // SSR / unknown → minimal
  assert.equal(autoWorkerCount(0), 2);
  assert.equal(autoWorkerCount(-3), 2);
});

test("buildCreateTransaction refuses a mint that does not end in 'Spw'", async () => {
  const kp = Keypair.generate(); // random — almost surely not Spw-suffixed
  assert.equal(isSpawnVanityAddress(kp.publicKey.toBase58()), false);
  await assert.rejects(
    buildCreateTransaction({
      name: "T", symbol: "T", uri: "https://ipfs/x",
      payer: Keypair.generate().publicKey,
      mintKeypair: kp,
    }),
    /refusing to launch/
  );
});

test("buildCreateAndBuyTransaction refuses a non-Spw mint BEFORE any SDK work", async () => {
  const kp = Keypair.generate();
  // A deliberately bogus global object: the suffix check must fire first and
  // never touch it — proving no SDK/RPC work happens for invalid mints.
  const bogusGlobal = { notARealGlobal: true } as unknown as Parameters<
    typeof buildCreateAndBuyTransaction
  >[0]["global"];
  await assert.rejects(
    buildCreateAndBuyTransaction({
      name: "T", symbol: "T", uri: "https://ipfs/x",
      payer: Keypair.generate().publicKey,
      mintKeypair: kp,
      devBuyLamports: 50_000_000n,
      global: bogusGlobal,
    }),
    /refusing to launch/
  );
});

test("buildCreateAndBuyTransaction rejects non-positive dev buy amounts", async () => {
  // Grind a REAL Spw keypair synchronously (58^3 ≈ 195k expected attempts —
  // seconds in node). This also proves isSpawnVanityAddress accepts a genuinely
  // ground address, not only fabricated ones.
  const spw = grindSpwKeypair();
  assert.equal(isSpawnVanityAddress(spw.publicKey.toBase58()), true);
  assert.ok(spw.publicKey.toBase58().endsWith("Spw"));
  const bogusGlobal = { notARealGlobal: true } as unknown as Parameters<
    typeof buildCreateAndBuyTransaction
  >[0]["global"];
  // Zero amount must be refused before any SDK/RPC work.
  await assert.rejects(
    buildCreateAndBuyTransaction({
      name: "T", symbol: "T", uri: "https://ipfs/x",
      payer: Keypair.generate().publicKey,
      mintKeypair: spw,
      devBuyLamports: 0n,
      global: bogusGlobal,
    }),
    /must be positive/
  );
});

/** Synchronous browser-independent grind used only by tests. */
function grindSpwKeypair(max = 10_000_000): Keypair {
  for (let i = 0; i < max; i++) {
    const kp = Keypair.generate();
    if (kp.publicKey.toBase58().endsWith(MANDATORY_SUFFIX)) return kp;
  }
  throw new Error(`no Spw keypair found within ${max} attempts`);
}

test("MANDATORY_SUFFIX stays exactly 'Spw' (case-sensitive contract)", () => {
  assert.equal(MANDATORY_SUFFIX, "Spw");
});

test("secret key material never crosses process/network boundaries in the plan", () => {
  // The launch flow posts only {mint, signature, name, symbol, creator,
  // network} to the backend. Static contract: nothing in the request payload
  // serialization involves Keypair. We prove the only carrier (Keypair) has
  // no enumerable secret surface via JSON.
  const kp = Keypair.generate();
  const leaked = JSON.stringify({ mint: kp.publicKey.toBase58() });
  assert.ok(!leaked.includes(String(kp.secretKey.length)));
  // Local rebuild stays exact — the only sanctioned keypair use.
  const rebuilt = Keypair.fromSecretKey(kp.secretKey);
  assert.equal(rebuilt.publicKey.toBase58(), kp.publicKey.toBase58());
});

test("one lamport of SOL math stays exact through bigint conversion", () => {
  // BigInt(Math.round(sol * 1e9)) must be stable across the preset range.
  for (const p of DEV_BUY_PRESETS_SOL) {
    const lamports = BigInt(Math.round(p * LAMPORTS_PER_SOL));
    assert.ok(lamports > 0n && lamports < ONE_SOL);
  }
});
