/**
 * Launch transaction size regression tests (node:test, run via tsx).
 *
 * Root cause guarded here: the ATOMIC create_v2 + buy_v2 transaction exceeded
 * Solana's hard 1232-byte packet limit ("Transaction too large: 1258 > 1232").
 * The metadata URI embedded in the create_v2 instruction data used a long
 * gateway host with a 59-char CIDv1 (93 chars total), and the transaction
 * carried two compute-budget instructions. The fix pins the on-chain metadata
 * URI to https://ipfs.io/ipfs/<CIDv0> (67 chars) and drops the compute-budget
 * instructions from the atomic bundle (Solana's default budget without a
 * SetComputeUnitLimit instruction is 200k CU per NON-builtin instruction =
 * 600k CU for create_v2 + ATA + buy_v2, which exceeds the ~500k the SDK
 * recommends even for token-quoted creates).
 *
 * Everything here is local: no RPC, no broadcast, no SOL. The builders are the
 * REAL production functions from lib/launch/launch.ts; the pump Global is a
 * fabricated fixture whose field shapes are all that the SDK reads offline.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Keypair, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import {
  buildCreateTransaction,
  buildCreateAndBuyTransaction,
  MAX_SERIALIZED_BYTES,
} from "../lib/launch/launch";
import type { Global } from "@pump-fun/pump-sdk";
import { MANDATORY_SUFFIX } from "../lib/config";

/** Any 32-byte base58 value stands in for a real blockhash (same byte size). */
const BLOCKHASH = Keypair.generate().publicKey.toBase58();

/** CIDv0, exactly 46 base58 chars — what the v0 upload path now produces. */
const CID_V0 = "QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG";
/** The on-chain metadata URI the launch flow now pins (67 chars). */
const URI_PINNED = `https://ipfs.io/ipfs/${CID_V0}`;
/** The URI shape that caused the production failure (93 chars):
 *  dedicated gateway host + 59-char CIDv1. */
const CID_V1 = "bafkreidgtumzgjgufpaq4rzc3ixpvw6sjapkjlt7irn7im5qo5yhbwht2u";
const URI_DEPLOYED_OLD = `https://gateway.pinata.cloud/ipfs/${CID_V1}`;

/** Fabricated pump Global (only field shapes matter for offline encoding).
 *  Numeric fields MUST be BN instances — the SDK's quote math calls .eq() on
 *  them (learned the hard way: native BigInt fails with
 *  "virtualTokenReserves.eq is not a function"). */
function fakeGlobal(): Global {
  const k = () => Keypair.generate().publicKey;
  return {
    initialized: true,
    authority: k(),
    feeRecipient: k(),
    initialVirtualTokenReserves: new BN("1073000000000000000"),
    initialVirtualSolReserves: new BN("30000000000"),
    initialRealTokenReserves: new BN("793100000000000000"),
    tokenTotalSupply: new BN("1000000000000000000"),
    feeBasisPoints: new BN(100),
    withdrawAuthority: k(),
    enableMigrate: true,
    poolMigrationFee: new BN(2000000000),
    creatorFeeBasisPoints: new BN(0),
    feeRecipients: [k(), k()],
    setCreatorAuthority: k(),
    adminSetCreatorAuthority: k(),
    createV2Enabled: true,
    whitelistPda: k(),
    reservedFeeRecipient: k(),
    mayhemModeEnabled: true,
    reservedFeeRecipients: [k()],
    isCashbackEnabled: false,
    buybackFeeRecipients: [k()],
    buybackBasisPoints: new BN(0),
    initialVirtualQuoteReserves: new BN("1073000000000000000"),
    whitelistedQuoteMints: [],
    creatorFeeConfigurable: false,
    maxConfigurableCreatorFeeBps: new BN(0),
    holderRewardClaimAuthority: k(),
  } as unknown as Global;
}

/** Lazily ground ONCE and shared by every test in this file. */
let sharedMint: Keypair | null = null;
function spwMint(): Keypair {
  if (!sharedMint) {
    for (let i = 0; i < 10_000_000; i++) {
      const kp = Keypair.generate();
      if (kp.publicKey.toBase58().endsWith(MANDATORY_SUFFIX)) {
        sharedMint = kp;
        break;
      }
    }
    if (!sharedMint) throw new Error("no Spw keypair found within 10M attempts");
  }
  return sharedMint;
}

/** Exact serialized wire size: mint partial-signs locally (no wallet yet), the
 *  fee-payer signature slot is counted but unfilled — identical byte count to
 *  the fully-signed packet (verified against the production failure size). */
function serializedWireSize(tx: Transaction, mint: Keypair): number {
  tx.partialSign(mint);
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    .length;
}

test("MAX_SERIALIZED_BYTES is Solana's hard 1232-byte packet limit", () => {
  assert.equal(MAX_SERIALIZED_BYTES, 1232);
});

test("create-only transaction fits the packet limit (regression)", async () => {
  const mint = spwMint();
  assert.ok(mint.publicKey.toBase58().endsWith("Spw"));
  const tx = await buildCreateTransaction(
    {
      name: "Test Token",
      symbol: "TEST",
      uri: URI_PINNED,
      payer: Keypair.generate().publicKey,
      mintKeypair: mint,
    },
    { recentBlockhash: BLOCKHASH }
  );
  // The preflight guard must not clobber the caller's blockhash.
  assert.equal(tx.recentBlockhash, BLOCKHASH);
  const size = serializedWireSize(tx, mint);
  console.log(`create-only wire size: ${size} bytes (limit ${MAX_SERIALIZED_BYTES})`);
  assert.ok(size <= MAX_SERIALIZED_BYTES, `create-only must fit, got ${size}`);
  // Stricter sanity bound: catch accidental size growth long before the limit.
  assert.ok(size <= 1000, `create-only grew unexpectedly: ${size}`);
});

test("ATOMIC create+buy fits the packet limit (regression: production failed at 1258)", async () => {
  const mint = spwMint();
  assert.ok(mint.publicKey.toBase58().endsWith("Spw"));
  const tx = await buildCreateAndBuyTransaction(
    {
      name: "Test Token",
      symbol: "TEST",
      uri: URI_PINNED,
      payer: Keypair.generate().publicKey,
      mintKeypair: mint,
      devBuyLamports: 10_000_000n, // 0.01 SOL — value never affects size
      global: fakeGlobal(),
    },
    { recentBlockhash: BLOCKHASH }
  );
  assert.equal(tx.recentBlockhash, BLOCKHASH);
  const size = serializedWireSize(tx, mint);
  console.log(`atomic create+buy wire size: ${size} bytes (limit ${MAX_SERIALIZED_BYTES})`);
  assert.ok(size <= MAX_SERIALIZED_BYTES, `atomic create+buy must fit, got ${size}`);
});

test("atomic create+buy also fits with the OLD deployed URI shape (93 chars)", async () => {
  // Defense in depth: even a metadata URI as long as the one that caused the
  // production failure must not push the fixed transaction over the limit.
  const mint = spwMint();
  const tx = await buildCreateAndBuyTransaction(
    {
      name: "Test Token",
      symbol: "TEST",
      uri: URI_DEPLOYED_OLD,
      payer: Keypair.generate().publicKey,
      mintKeypair: mint,
      devBuyLamports: 10_000_000n,
      global: fakeGlobal(),
    },
    { recentBlockhash: BLOCKHASH }
  );
  const size = serializedWireSize(tx, mint);
  console.log(`atomic (93-char URI) wire size: ${size} bytes`);
  assert.ok(size <= MAX_SERIALIZED_BYTES, `must fit even with the old URI, got ${size}`);
});

test("no-buy path fits even with maximum-length name and symbol", async () => {
  const mint = spwMint();
  const tx = await buildCreateTransaction(
    {
      name: "A".repeat(64),
      symbol: "TESTTOKENZ", // 10 chars (pump.fun symbol limit)
      uri: URI_PINNED,
      payer: Keypair.generate().publicKey,
      mintKeypair: mint,
    },
    { recentBlockhash: BLOCKHASH }
  );
  const size = serializedWireSize(tx, mint);
  console.log(`create-only (max name/symbol) wire size: ${size} bytes`);
  assert.ok(size <= MAX_SERIALIZED_BYTES, `no-buy path must always fit, got ${size}`);
});

test("oversized atomic launch fails LOUDLY with an actionable error", async () => {
  const mint = spwMint();
  // Worst case: maximum name + maximum symbol + the long deployed-gateway URI.
  let thrown: Error | null = null;
  try {
    await buildCreateAndBuyTransaction(
      {
        name: "A".repeat(64),
        symbol: "TESTTOKENZ",
        uri: URI_DEPLOYED_OLD,
        payer: Keypair.generate().publicKey,
        mintKeypair: mint,
        devBuyLamports: 10_000_000n,
        global: fakeGlobal(),
      },
      { recentBlockhash: BLOCKHASH }
    );
  } catch (e) {
    thrown = e as Error;
  }
  assert.ok(thrown, "oversized transaction must be refused");
  assert.match(thrown.message, /1232/);
  assert.match(thrown.message, /packet limit/);
  // Actionable: the user must be told exactly what to change.
  assert.match(thrown.message, /shorten the token name or symbol/);
  assert.match(thrown.message, /Dev Initial Buy/);
});

