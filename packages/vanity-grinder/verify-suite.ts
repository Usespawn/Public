// Direct verification of the vanity-grinder: mirrors grinder.test.ts
// without node --test (the runner hangs on this Windows env).
import assert from "node:assert/strict";
import {
  DEFAULT_SUFFIX,
  expectedAttempts,
  grindVanityKeypair,
  isBase58,
  vanityMatches,
} from "./src/grinder";

async function main() {
  // 1-7: pure logic
  assert.equal(vanityMatches("1B8xSpw", { suffix: "Spw" }), true);
  assert.equal(vanityMatches("1B8xspw", { suffix: "Spw" }), false);
  assert.equal(vanityMatches("1B8xspw", { suffix: "Spw", caseInsensitive: true }), true);
  assert.equal(vanityMatches("1B8xSPW", { suffix: "Spw", caseInsensitive: true }), true);
  assert.equal(vanityMatches("SpwabcSpw", { suffix: "Spw", prefix: "Spw" }), true);
  assert.equal(vanityMatches("XpwabcSpw", { suffix: "Spw", prefix: "Spw" }), false);
  assert.equal(vanityMatches("anything", {}), true);
  assert.equal(isBase58("Spw"), true);
  assert.equal(isBase58("OIl0"), false);
  assert.equal(isBase58("8x!"), false);
  assert.equal(expectedAttempts(3), 195_112);
  assert.equal(expectedAttempts(3, true), 29 ** 3);
  assert.equal(expectedAttempts(1), 58);
  assert.equal(DEFAULT_SUFFIX, "Spw");
  console.log("[1/2] pure-logic assertions: OK");

  // 8/9: rejection paths (fail-fast, no pool)
  await assert.rejects(() => grindVanityKeypair({ suffix: "OIl" }), /non-base58/);
  await assert.rejects(() => grindVanityKeypair({ suffix: "SpwSpwSp" }), /pattern too long/);
  console.log("[2/2] rejection paths: OK");

  // 10: live end-to-end grind with a hard cap.
  const res = await grindVanityKeypair({ suffix: "Spw", threads: 4, maxAttempts: 5_000_000 });
  assert.ok(res.publicKey.endsWith("Spw"), `got ${res.publicKey}`);
  assert.equal(res.secretKey.length, 64);
  assert.ok(res.attempts > 0);
  assert.ok(res.elapsedMs > 0);
  console.log(
    `[live grind] ${res.publicKey} — ${res.attempts.toLocaleString()} attempts @ ${res.ratePerSec.toLocaleString()}/s in ${(res.elapsedMs / 1000).toFixed(2)}s`
  );
  console.log("GRINDER-SUITE-OK");
  process.exit(0);
}

main().catch((e) => {
  console.error("GRINDER-SUITE-FAIL", e);
  process.exit(1);
});
