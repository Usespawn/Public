/**
 * Two-stage dev-buy flow regression tests (node:test, run via tsx).
 *
 * SpacePad post-mortem guards (reference failure, NOT observed in SpawnPad):
 * the SpacePad launch created the token but the developer buy never executed,
 * alongside "Transaction too large: 1258 > 1232" — an oversized create+buy
 * transaction rejected BEFORE execution, with the UI still reporting the
 * creation as overall success.
 *
 * SpawnPad's defenses verified here, all OFFLINE (no RPC, no signing, no
 * broadcast, no SOL, no wallet approval):
 *  - the standalone dev-buy builder (official SDK buyV2Instructions) builds a
 *    correct, correctly-ordered, correctly-signed transaction that fits the
 *    1232-byte packet limit;
 *  - the user's authorized SOL amount propagates into the instruction data
 *    (never ignored, never zero, never silently modified);
 *  - the "combined transaction too large" condition is a TYPED error so the
 *    launch flow can switch to create + separate buy automatically;
 *  - on-chain verification refuses to fabricate success: a missing or failed
 *    buy transaction always throws, so a confirmed creation can never be
 *    reported as a completed dev buy.
 *
 * The fixtures were validated against the real SDK (v4.3.1) offline: the
 * fabricated BondingCurve/Global objects drive the SDK's real quote math and
 * real instruction builders (probe scripts/_probe-twostage.cjs).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import type { Connection } from "@solana/web3.js";
import {
  buildStandaloneBuyTransaction,
  computeExpectedTokensOnCurve,
  signBuyTransaction,
  assertLaunchTxSize,
  verifyDevBuyOnChain,
  confirmLaunch,
  LaunchTxTooLargeError,
  MAX_SERIALIZED_BYTES,
  type PumpBuyState,
  type LaunchSigner,
} from "../lib/launch/launch";
import { PUMP_PROGRAM_ID, MANDATORY_SUFFIX } from "../lib/config";
import type { BondingCurve, Global } from "@pump-fun/pump-sdk";

/** The pump.fun bonding-curve program (buy_v2 target). */
const PUMP_FUN_PROGRAM = PUMP_PROGRAM_ID;
/** SPL associated-token program id (ATA idempotent create instruction). */
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
/** Token-2022 program id (pump v2 mints). */
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const BLOCKHASH = Keypair.generate().publicKey.toBase58();

/** Little-endian u64 byte pattern (borsh integer encoding). */
function leU64(n: bigint | string): Buffer {
  const hex = BigInt(n).toString(16).padStart(16, "0");
  return Buffer.from(hex.match(/../g)!.reverse().join(""), "hex");
}

/** Fabricated pump Global — BN fields only, shape-identical to production. */
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

/**
 * Fabricated decoded BondingCurve for a BRAND-NEW SOL curve (zero-key quote
 * mint, nothing bought yet). Shape matches the SDK's real decoder; the quote
 * math below was cross-checked against the real SDK offline.
 */
function fakeFreshCurve(creator = Keypair.generate().publicKey): BondingCurve {
  return {
    virtualTokenReserves: new BN("1073000000000000000"),
    virtualQuoteReserves: new BN("30000000000"),
    realTokenReserves: new BN("793100000000000000"),
    realQuoteReserves: new BN(0),
    tokenTotalSupply: new BN("1000000000000000000"),
    complete: false,
    creator,
    isMayhemMode: false,
    isCashbackCoin: false,
    quoteMint: SystemProgram.programId, // zero key = SOL-quoted curve
    creatorFeeBps: new BN(0),
    canEditCreatorFee: false,
    isHolderReward: false,
    creatorFee: new BN(0),
    protocolFees: new BN(0),
    depth: 0,
    initialVirtualQuoteReserves: new BN("1073000000000000000"),
    postCompleteBaseOut: new BN(0),
    postCompleteQuoteIn: new BN(0),
  } as unknown as BondingCurve;
}

/** Raw on-chain curve account fixture (166 bytes = BONDING_CURVE_SIZE). */
function fakeCurveAccountInfo() {
  return {
    executable: false,
    owner: PUMP_FUN_PROGRAM,
    lamports: 1_000_000,
    rentEpoch: 0,
    data: Buffer.alloc(166),
  };
}

function fakeBuyState(opts?: {
  ataExists?: boolean;
  bondingCurve?: BondingCurve;
}): PumpBuyState {
  return {
    quoteMint: Keypair.generate().publicKey, // normalized by the SDK; unused here
    quoteTokenProgram: TOKEN_2022,
    quoteTransferFee: null,
    bondingCurveAccountInfo: fakeCurveAccountInfo(),
    bondingCurve: opts?.bondingCurve ?? fakeFreshCurve(),
    associatedUserAccountInfo: opts?.ataExists
      ? {
          executable: false,
          owner: TOKEN_2022,
          lamports: 2_039_280,
          data: Buffer.alloc(165),
        }
      : null,
    curveBaseTokenBalance: new BN("793100000000000000"),
  } as unknown as PumpBuyState;
}

/** Lazily ground ONE real Spw mint and share it across tests. */
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

async function buildBuy(
  args: {
    mint58?: string;
    user?: PublicKey;
    devBuyLamports?: bigint;
    global?: Global;
    buyState?: PumpBuyState;
  },
  ataExists?: boolean
) {
  return buildStandaloneBuyTransaction(
    {
      mint58: args.mint58 ?? spwMint().publicKey.toBase58(),
      user: args.user ?? Keypair.generate().publicKey,
      devBuyLamports: args.devBuyLamports ?? 10_000_000n,
      global: args.global ?? fakeGlobal(),
      buyState: args.buyState ?? fakeBuyState({ ataExists }),
    },
    { recentBlockhash: BLOCKHASH }
  );
}

// ---------------------------------------------------------------------------
// Quote math
// ---------------------------------------------------------------------------

test("computeExpectedTokensOnCurve quotes the fresh curve exactly (SDK math)", async () => {
  const amt = await computeExpectedTokensOnCurve(fakeGlobal(), fakeFreshCurve(), 10_000_000n);
  // Cross-checked offline against the real SDK for this fixture (probe).
  assert.equal(amt.toString(), "354008538745065");
  const amt2 = await computeExpectedTokensOnCurve(fakeGlobal(), fakeFreshCurve(), 50_000_000n);
  assert.ok(amt2.gt(amt), "a bigger budget must quote more tokens");
});

// ---------------------------------------------------------------------------
// Standalone buy construction
// ---------------------------------------------------------------------------

test("standalone buy builds [ATA create, buy_v2] when the user has no ATA yet", async () => {
  const tx = await buildBuy({}, false);
  assert.equal(tx.instructions.length, 2);
  // Ordering per the SDK: idempotent ATA create FIRST, buy_v2 LAST.
  assert.equal(tx.instructions[0].programId.toBase58(), ATA_PROGRAM.toBase58());
  assert.equal(tx.instructions[1].programId.toBase58(), PUMP_FUN_PROGRAM.toBase58());
});

test("standalone buy is a single buy_v2 when the user ATA already exists", async () => {
  const tx = await buildBuy({}, true);
  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0].programId.toBase58(), PUMP_FUN_PROGRAM.toBase58());
});

test("standalone buy fits the 1232-byte packet limit with big headroom", async () => {
  const tx = await buildBuy({}, false);
  assert.equal(tx.recentBlockhash, BLOCKHASH); // guard must not clobber it
  const msg = tx.compileMessage();
  const size = msg.serialize().length + 1 + 64 * msg.header.numRequiredSignatures;
  console.log(`standalone dev-buy wire size: ${size} bytes (limit ${MAX_SERIALIZED_BYTES})`);
  assert.ok(size <= MAX_SERIALIZED_BYTES, `buy must fit, got ${size}`);
  assert.ok(size <= 1100, `buy grew unexpectedly: ${size}`);
});

test("user's SOL amount propagates into the buy instruction data (never ignored)", async () => {
  const devBuyLamports = 25_000_000n; // 0.025 SOL
  const tx = await buildBuy({ devBuyLamports }, false);
  const buy = tx.instructions[tx.instructions.length - 1];
  const data = Buffer.from(buy.data);
  // arg0 @8: quoted token amount (exact SDK math for the budget).
  const quoted = await computeExpectedTokensOnCurve(fakeGlobal(), fakeFreshCurve(), devBuyLamports);
  assert.ok(
    data.subarray(8).indexOf(leU64(quoted.toString())) !== -1,
    "quoted token amount must be encoded in the buy data"
  );
  // arg1 @16: max SOL cost = budget + the SDK's 1% slippage margin — never
  // LESS than the budget (the buy could not execute) and never MORE than
  // budget+1% (the user's authorization is respected, identical to the
  // atomic bundle the SDK builds for itself). Borsh u64 = little-endian.
  const maxSol = BigInt(new BN(data.subarray(16, 24), "le").toString());
  assert.equal(maxSol, devBuyLamports + (devBuyLamports * 10n) / 1000n);
  assert.ok(maxSol >= devBuyLamports, "max cost must cover the budget");
  assert.ok(maxSol <= (devBuyLamports * 101n) / 100n, "max cost may exceed the budget by at most the SDK's 1%");
});

test("the connected wallet is the buyer AND the fee payer AND the only signer", async () => {
  const user = Keypair.generate().publicKey;
  const tx = await buildBuy({ user }, false);
  assert.ok(tx.feePayer!.equals(user), "wallet must be the fee payer");
  const msg = tx.compileMessage();
  assert.equal(msg.header.numRequiredSignatures, 1, "only the wallet signs");
  assert.ok(msg.accountKeys[0].equals(user), "wallet is the first (signer) account");
  // The mint pubkey may appear as a READONLY account (buy_v2 references it),
  // but it must never be a required signer — only the wallet signs.
  const mintIdx = msg.accountKeys.findIndex((k) => k.equals(spwMint().publicKey));
  if (mintIdx >= 0) {
    assert.ok(mintIdx >= msg.header.numRequiredSignatures, "mint must be a non-signer account");
  }
});

test("signBuyTransaction returns verified wallet-only signed bytes", async () => {
  const walletKp = Keypair.generate(); // stands in for the user's wallet (in-memory)
  const wallet: LaunchSigner = {
    signTransaction: async (tx) => {
      tx.sign(walletKp);
      return tx;
    },
  };
  const tx = await buildBuy({ user: walletKp.publicKey }, false);
  const raw = await signBuyTransaction(tx, wallet);
  const back = Transaction.from(raw);
  assert.ok(back.feePayer!.equals(walletKp.publicKey));
  // Fully signed: every required signature slot is filled (verifySignatures
  // was on during serialize, so these are real, verified signatures).
  assert.ok(back.signatures.every((s) => s !== null), "all signatures present");
  assert.ok(raw.length > 0);
});

// ---------------------------------------------------------------------------
// Guards — the amount can never silently become zero or be dropped
// ---------------------------------------------------------------------------

test("standalone buy refuses a non-Spw mint BEFORE any SDK/RPC work", async () => {
  const kp = Keypair.generate();
  assert.equal(kp.publicKey.toBase58().endsWith("Spw"), false);
  const bogusState = { notARealState: true } as unknown as PumpBuyState;
  await assert.rejects(
    buildStandaloneBuyTransaction({
      mint58: kp.publicKey.toBase58(),
      user: Keypair.generate().publicKey,
      devBuyLamports: 10_000_000n,
      global: fakeGlobal(),
      buyState: bogusState,
    }),
    /refusing to buy/
  );
});

test("standalone buy rejects zero and negative dev buy amounts", async () => {
  const bogusState = { notARealState: true } as unknown as PumpBuyState;
  await assert.rejects(
    buildStandaloneBuyTransaction({
      mint58: spwMint().publicKey.toBase58(),
      user: Keypair.generate().publicKey,
      devBuyLamports: 0n,
      global: fakeGlobal(),
      buyState: bogusState,
    }),
    /must be positive/
  );
  await assert.rejects(
    buildStandaloneBuyTransaction({
      mint58: spwMint().publicKey.toBase58(),
      user: Keypair.generate().publicKey,
      devBuyLamports: -5n,
      global: fakeGlobal(),
      buyState: bogusState,
    }),
    /must be positive/
  );
});

test("standalone buy is blocked when the curve has no tokens left to sell", async () => {
  // Probe-informed: the SDK's getBuyTokenAmountFromSolAmount returns exactly
  // zero when bondingCurve.virtualTokenReserves is zero — the guard must
  // reject instead of building a losing buy.
  const deadCurve = fakeFreshCurve();
  (deadCurve as { virtualTokenReserves: BN }).virtualTokenReserves = new BN(0);
  await assert.rejects(
    buildBuy({ buyState: fakeBuyState({ bondingCurve: deadCurve }) }, false),
    /quote returned no tokens/
  );
});

test("quote uses the LIVE curve, not Global initial reserves (probe-informed)", async () => {
  // Regression for the mintSupply fix: with mintSupply null the SDK silently
  // rebuilt the curve from Global and ignored the passed state — a progressed
  // curve quoted at its INITIAL price. A curve with half the tokens left at
  // the same quote reserves must now quote clearly fewer tokens.
  const progressed = fakeFreshCurve();
  (progressed as { virtualTokenReserves: BN }).virtualTokenReserves = new BN("500000000000000000");
  const fresh = await computeExpectedTokensOnCurve(fakeGlobal(), fakeFreshCurve(), 10_000_000n);
  const live = await computeExpectedTokensOnCurve(fakeGlobal(), progressed, 10_000_000n);
  assert.ok(live.gt(0), "progressed curve must still quote tokens");
  assert.ok(live.lt(fresh), `progressed curve must quote fewer tokens (live=${live} fresh=${fresh})`);
});

// ---------------------------------------------------------------------------
// The typed too-large error (the automatic two-stage trigger)
// ---------------------------------------------------------------------------

test("assertLaunchTxSize throws a TYPED LaunchTxTooLargeError with the wire size", () => {
  // A deliberately bloated transaction (many no-op instructions) that exceeds
  // the packet limit; the typed error must carry its wire size.
  const bloated = new Transaction();
  bloated.feePayer = Keypair.generate().publicKey; // compileMessage requires one
  for (let i = 0; i < 400; i++) {
    bloated.add(
      new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [],
        data: Buffer.from([0]),
      })
    );
  }
  bloated.recentBlockhash = BLOCKHASH;
  assert.throws(() => assertLaunchTxSize(bloated), (e: unknown) => {
    assert.ok(e instanceof LaunchTxTooLargeError, "must be the typed error");
    const err = e as LaunchTxTooLargeError;
    assert.ok(err.wireSize > MAX_SERIALIZED_BYTES);
    assert.match(err.message, /1232/);
    assert.match(err.message, /packet limit/);
    return true;
  });
});

// ---------------------------------------------------------------------------
// On-chain verification NEVER fabricates success
// ---------------------------------------------------------------------------

/** Fake Connection (no network): only the methods the verifiers touch. */
function fakeRpc(rpc: {
  parsedTransaction?: unknown;
  statuses?: Array<{ err: unknown; confirmationStatus: string } | null>;
}): Connection {
  return {
    async getParsedTransaction() {
      return rpc.parsedTransaction ?? null;
    },
    async getSignatureStatuses() {
      return { value: rpc.statuses ?? [null] };
    },
  } as unknown as Connection;
}

const MINT58 = spwMint().publicKey.toBase58();
const USER58 = Keypair.generate().publicKey.toBase58();

test("verifyDevBuyOnChain throws when the transaction is not found on-chain", async () => {
  await assert.rejects(
    verifyDevBuyOnChain(MINT58, USER58, "sig_notfound", fakeRpc({ parsedTransaction: null })),
    /not found on-chain.*dev buy unverified/
  );
});

test("verifyDevBuyOnChain throws when the buy transaction FAILED on-chain", async () => {
  const failedTx = { meta: { err: { InstructionError: [1, "Custom"] } } };
  await assert.rejects(
    verifyDevBuyOnChain(MINT58, USER58, "sig_failed", fakeRpc({ parsedTransaction: failedTx })),
    /failed on-chain/
  );
});

test("verifyDevBuyOnChain throws when the creator received NO tokens", async () => {
  // A succeeded tx without a creator token-balance increase must never be
  // reported as a successful buy.
  const noTokensTx = {
    meta: {
      err: null,
      preBalances: [10_000_000_000, 5_000_000_000],
      postBalances: [9_999_995_000, 5_000_000_000],
      preTokenBalances: [],
      postTokenBalances: [],
    },
  };
  await assert.rejects(
    verifyDevBuyOnChain(MINT58, USER58, "sig_empty", fakeRpc({ parsedTransaction: noTokensTx })),
    /no creator token balance increase/
  );
});

test("verifyDevBuyOnChain reports SOL spent and tokens received from REAL diffs", async () => {
  const okTx = {
    meta: {
      err: null,
      preBalances: [10_000_000_000, 5_000_000_000],
      postBalances: [9_999_495_000, 5_000_000_000], // creator paid 505k lamports
      preTokenBalances: [],
      postTokenBalances: [
        {
          accountIndex: 1,
          mint: MINT58,
          owner: USER58,
          uiTokenAmount: { uiAmount: 354_008_538.745065, decimals: 6 },
        },
      ],
    },
  };
  const v = await verifyDevBuyOnChain(MINT58, USER58, "sig_ok", fakeRpc({ parsedTransaction: okTx }));
  assert.equal(v.solSpentLamports, 505_000);
  assert.ok(v.tokensReceived !== null && v.tokensReceived > 354_000_000);
});

test("confirmLaunch throws on an on-chain failure (never reports success)", async () => {
  await assert.rejects(
    confirmLaunch(
      fakeRpc({ statuses: [{ err: { SomeFailure: true }, confirmationStatus: "confirmed" }] }),
      "sig",
      60_000
    ),
    /failed on-chain/
  );
});

test("confirmLaunch times out instead of guessing (no success without proof)", async () => {
  await assert.rejects(
    confirmLaunch(fakeRpc({ statuses: [null] }), "sig_pending", 0),
    /timed out/
  );
});

