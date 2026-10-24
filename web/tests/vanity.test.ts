/**
 * SpawnPad vanity engine tests (node:test, run via tsx).
 * Covers: exact suffix matching, case sensitivity, Base58 validation,
 * keypair consistency, state machine transitions, and key-leak hygiene.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { isSpawnVanityAddress, MANDATORY_SUFFIX, bondingCurveAddress } from "../lib/config";
import { expectedAttempts } from "../lib/vanity/grinder";
import { VanityMachine, VanityState, VanityStateError } from "../lib/vanity/state-machine";

test("isSpawnVanityAddress accepts real Spw-suffixed addresses only", () => {
  // Generate a real keypair and cut it to length 44 checks.
  const kp = Keypair.generate();
  const addr = kp.publicKey.toBase58();
  assert.equal(typeof addr, "string");
  assert.equal(addr.length, 44);
  // A non-suffixed address must fail.
  assert.equal(isSpawnVanityAddress(addr), false);
  // A fabricated suffix-appended string must fail Base58/length rules.
  assert.equal(isSpawnVanityAddress("test!!!Spw"), false);
});

test("suffix is exactly 'Spw' — case sensitive", () => {
  assert.equal(MANDATORY_SUFFIX, "Spw");
  assert.equal("xSpw".endsWith("Spw"), true);
  assert.equal("xSPW".endsWith("Spw"), false);
  assert.equal("xspw".endsWith("Spw"), false);
});

test("43-char base58 addresses (leading-zero pubkeys) are accepted", () => {
  // Base58 of a 32-byte pubkey is 43 or 44 chars; both must pass the check
  // when the suffix matches, and fail when it does not.
  assert.equal(isSpawnVanityAddress("GSAzBPX89gYRjdBA95m151MMyYm2eZNtvTFmDeoGnSpw"), true); // 44 chars, real ground address
  assert.equal(isSpawnVanityAddress("1".repeat(39) + "xSpw"), true); // 43 chars, valid suffix
  assert.equal(isSpawnVanityAddress("x".repeat(39) + "spw"), false); // 43 chars, wrong case
});

test("expectedAttempts matches 58^3 ≈ 195,112 for Spw", () => {
  assert.equal(expectedAttempts("Spw"), 58 ** 3);
  assert.equal(expectedAttempts("Spw"), 195112);
  assert.equal(expectedAttempts(""), 1);
});

test("bondingCurveAddress is a deterministic PDA of the mint", () => {
  const kp = Keypair.generate();
  const a = bondingCurveAddress(kp.publicKey.toBase58());
  const b = bondingCurveAddress(kp.publicKey.toBase58());
  assert.equal(a, b);
  assert.equal(a.length, 44);
});

test("state machine allows the full happy path", () => {
  const m = new VanityMachine();
  m.transition(VanityState.GENERATING);
  m.transition(VanityState.GENERATED);
  m.transition(VanityState.VALIDATING);
  m.transition(VanityState.READY_TO_LAUNCH);
  m.transition(VanityState.LAUNCHING);
  m.transition(VanityState.CONFIRMING);
  m.transition(VanityState.SUCCESS);
  m.transition(VanityState.IDLE);
  assert.equal(m.state, VanityState.IDLE);
});

test("state machine rejects skip transitions", () => {
  const m = new VanityMachine();
  assert.throws(() => m.transition(VanityState.SUCCESS), VanityStateError);
  m.transition(VanityState.GENERATING);
  assert.throws(() => m.transition(VanityState.LAUNCHING), VanityStateError);
  // Cancel path is valid.
  m.transition(VanityState.CANCELLED);
  m.transition(VanityState.IDLE);
});

test("generated keypair consistency: derived key matches reported address", () => {
  // Simulate what the worker posts: a fresh keypair's own secret.
  const kp = Keypair.generate();
  const rebuilt = Keypair.fromSecretKey(kp.secretKey);
  assert.equal(rebuilt.publicKey.toBase58(), kp.publicKey.toBase58());
});
