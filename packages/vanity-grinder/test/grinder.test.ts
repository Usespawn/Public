import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SUFFIX,
  expectedAttempts,
  grindVanityKeypair,
  isBase58,
  vanityMatches,
} from "../src/grinder";

test("vanityMatches: exact-case suffix", () => {
  assert.equal(vanityMatches("1B8xSpw", { suffix: "Spw" }), true);
  assert.equal(vanityMatches("1B8xspw", { suffix: "Spw" }), false);
});

test("vanityMatches: case-insensitive suffix", () => {
  assert.equal(vanityMatches("1B8xspw", { suffix: "Spw", caseInsensitive: true }), true);
  assert.equal(vanityMatches("1B8xSPW", { suffix: "Spw", caseInsensitive: true }), true);
});

test("vanityMatches: prefix + suffix", () => {
  assert.equal(vanityMatches("SpwabcSpw", { suffix: "Spw", prefix: "Spw" }), true);
  assert.equal(vanityMatches("XpwabcSpw", { suffix: "Spw", prefix: "Spw" }), false);
});

test("vanityMatches: empty pattern matches everything", () => {
  assert.equal(vanityMatches("anything", {}), true);
});

test("isBase58 rejects non-base58 chars", () => {
  assert.equal(isBase58("Spw"), true);
  assert.equal(isBase58("OIl0"), false); // excluded chars
  assert.equal(isBase58("8x!"), false);
});

test("expectedAttempts: 3-char exact suffix = 58^3", () => {
  assert.equal(expectedAttempts(3), 195_112);
  assert.equal(expectedAttempts(3, true), 29 ** 3);
  assert.equal(expectedAttempts(1), 58);
});

test("default suffix is Spw", () => {
  assert.equal(DEFAULT_SUFFIX, "Spw");
});

test("rejects non-base58 suffix", async () => {
  await assert.rejects(
    () => grindVanityKeypair({ suffix: "OIl" }),
    /non-base58/
  );
});

test("rejects patterns longer than 8 chars", async () => {
  await assert.rejects(
    () => grindVanityKeypair({ suffix: "SpwSpwSp" }),
    /pattern too long/
  );
});

test("grinds a ...Spw mint keypair end-to-end", { timeout: 180_000 }, async () => {
  const res = await grindVanityKeypair({ suffix: "Spw", threads: 4 });
  assert.ok(res.publicKey.endsWith("Spw"), `got ${res.publicKey}`);
  assert.equal(res.secretKey.length, 64);
  assert.ok(res.keypair.publicKey.toBase58() === res.publicKey);
  assert.ok(res.attempts > 0);
  assert.ok(res.elapsedMs > 0);
  console.log(
    `[grinder] ${res.publicKey} — ${res.attempts.toLocaleString()} attempts @ ${res.ratePerSec.toLocaleString()}/s in ${(res.elapsedMs / 1000).toFixed(2)}s`
  );
});
