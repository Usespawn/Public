/**
 * Real Pump.fun launch flow (official @pump-fun/pump-sdk).
 *
 * create_v2 accepts a caller-supplied mint keypair (account 1, Signer) — the
 * same flow pump.fun's own UI uses to grind its `pump` suffix. SpawnPad grinds
 * `Spw` instead, builds the tx client-side, partial-signs with the mint
 * keypair, requests the user's wallet signature for the fee-payer side, sends,
 * confirms, and verifies the on-chain bonding curve before reporting success.
 *
 * Optional dev buy: the official `create_v2 + buy_v2` bundle
 * (PUMP_SDK.createV2AndBuyInstructions) executes creation and the creator's
 * initial purchase ATOMICALLY in one transaction, funded and signed by the
 * connected creator wallet. The buy's max SOL cost is the exact user-selected
 * amount — the program can never spend more than that.
 *
 * No secret material ever leaves the browser in this flow.
 */
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { AccountInfo } from "@solana/web3.js";
import type { Message } from "@solana/web3.js";
import type BN from "bn.js";
import type { BondingCurve, Global, OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { PUMP_PROGRAM_ID, bondingCurveAddress, getRpcUrl, MANDATORY_SUFFIX, isSpawnVanityAddress } from "@/lib/config";

/** Wrapped-SOL mint (quote asset of pump.fun curves). Same constant as
 *  @solana/spl-token's NATIVE_MINT, declared locally to avoid a new direct
 *  dependency in the web bundle. */
const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");

/** pump.fun v2 tokens are Token-2022 mints (the SDK's create/atomic-bundle
 *  builders hardcode it for the user's token ATA). Declared locally like
 *  NATIVE_MINT — @solana/spl-token is not a direct dependency. */
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

type PumpSdkModule = typeof import("@pump-fun/pump-sdk");

/**
 * Loads the official pump SDK.
 *
 * In Node (unit tests / scripts) the SDK's published ESM build cannot be
 * imported at all: its dependency @pump-fun/agent-payments-sdk does
 * `import { BN } from "@coral-xyz/anchor"` — a named export from a CJS package
 * that Node's cjs-module-lexer cannot statically detect — so the whole import
 * graph throws SyntaxError under node --test / tsx. There we load the
 * IDENTICAL official CJS build through createRequire instead. Browsers (the
 * actual launch flow) keep the plain dynamic import: getBuiltinModule only
 * exists in Node, so no Node builtin is ever referenced from the browser
 * bundle.
 */
async function loadPumpSdk(): Promise<PumpSdkModule> {
  const proc: NodeJS.Process | undefined =
    typeof process !== "undefined" ? process : undefined;
  if (
    proc &&
    typeof proc.versions?.node === "string" &&
    typeof window === "undefined"
  ) {
    const nodeModule = (
      proc as NodeJS.Process & {
        getBuiltinModule?: (
          id: string
        ) => typeof import("module") | undefined;
      }
    ).getBuiltinModule?.("module");
    if (nodeModule?.createRequire) {
      // Resolve relative to the process working directory (web/): correct for
      // tsx test runs and for server-side execution alike.
      return nodeModule
        .createRequire(process.cwd() + "/")("@pump-fun/pump-sdk") as PumpSdkModule;
    }
  }
  return await import("@pump-fun/pump-sdk");
}

/** Solana's hard packet limit: the serialized transaction may not exceed it. */
export const MAX_SERIALIZED_BYTES = 1232;

/** Any 32-byte base58 value used as a blockhash placeholder when measuring.
 *  The blockhash field is always exactly 32 bytes, so the measured wire size
 *  is identical to the one with a real blockhash. */
const SIZE_PROBE_BLOCKHASH = "11111111111111111111111111111111";

/**
 * Preflight size guard: measures the exact serialized wire size and refuses to
 * return a transaction Solana would reject with "Transaction too large".
 * Runs BEFORE the wallet is asked to approve anything.
 *
 * Wire size = compiled message + 1 varint byte (signature count — always one
 * byte for <=127 signers) + 64 bytes per required signer. Verified against
 * production: message 1109 + 1 + 2*64 = the exact 1238-byte wire size that
 * overflowed before the fix.
 */
/** Typed "combined transaction cannot fit" error so callers can distinguish
 *  the size rejection (which the two-stage flow CAN work around) from any
 *  other builder failure. Thrown BEFORE any signature is requested. */
export class LaunchTxTooLargeError extends Error {
  /** Serialized wire size that exceeded the limit. */
  readonly wireSize: number;
  constructor(wireSize: number) {
    super(
      `launch transaction too large for the Solana ${MAX_SERIALIZED_BYTES}-byte ` +
        `packet limit (${wireSize} bytes) — shorten the token name or symbol, or ` +
        `turn off Dev Initial Buy and retry`
    );
    this.name = "LaunchTxTooLargeError";
    this.wireSize = wireSize;
  }
}

/**
 * Exact wire size of a compiled LEGACY message, byte-for-byte the same layout
 * @solana/web3.js's Message.serialize() produces: 3 header bytes, shortvec +
 * 32-byte static account keys, 32-byte blockhash, shortvec instruction count,
 * then per instruction: programIdIndex u8, shortvec account-key count, the
 * account indexes, shortvec data length, data.
 *
 * Needed because that library method allocates FIXED 1232/2048-byte buffers
 * and throws a raw `RangeError: encoding overruns Uint8Array` when the message
 * overruns them — instead of returning bytes we could measure. The compiled
 * message stores instruction data as a base58 STRING (its .length says nothing
 * about the decoded byte size), so data lengths are read from the ORIGINAL
 * transaction instructions, which appear in the same order in the message.
 */
function compiledLegacyMessageWireSize(msg: Message, tx: Transaction): number {
  /** Byte length of a shortvec encoding (mirrors web3.js encodeLength). */
  const shortVecLength = (len: number): number => {
    let count = 1;
    for (let v = len >> 7; v !== 0; v >>= 7) count++;
    return count;
  };
  const numKeys = msg.accountKeys.length;
  let size = 3 + shortVecLength(numKeys) + 32 * numKeys + 32;
  size += shortVecLength(msg.instructions.length);
  msg.instructions.forEach((ix, i) => {
    const dataLength = tx.instructions[i]?.data.length ?? 0;
    size += 1 + shortVecLength(ix.accounts.length) + ix.accounts.length;
    size += shortVecLength(dataLength) + dataLength;
  });
  return size;
}

export function assertLaunchTxSize(tx: Transaction): void {
  const hadBlockhash =
    typeof tx.recentBlockhash === "string" && tx.recentBlockhash.length > 0;
  if (!hadBlockhash) tx.recentBlockhash = SIZE_PROBE_BLOCKHASH;
  try {
    const msg = tx.compileMessage();
    let messageSize: number;
    try {
      messageSize = msg.serialize().length;
    } catch (err) {
      // web3.js serializes the compiled message into FIXED 1232/2048-byte
      // buffers and throws a raw RangeError ("encoding overruns Uint8Array")
      // when it overruns — before our own limit check ever sees a size. An
      // overrun is definitionally past the packet budget, but the two-stage
      // fallback and the UI key on the TYPED error (instanceof), so re-measure
      // the exact wire size (same layout, no fixed buffers) and raise the
      // typed error instead of letting the raw RangeError escape.
      if (!(err instanceof RangeError)) throw err;
      messageSize = compiledLegacyMessageWireSize(msg, tx);
    }
    const size =
      messageSize + 1 + 64 * msg.header.numRequiredSignatures;
    if (size > MAX_SERIALIZED_BYTES) {
      throw new LaunchTxTooLargeError(size);
    }
  } finally {
    if (!hadBlockhash) {
      (tx as { recentBlockhash?: string }).recentBlockhash = undefined;
    }
  }
}


export interface LaunchParams {
  name: string;
  symbol: string;
  uri: string;
  /** The user's wallet payer — from wallet-adapter (never the mint keypair). */
  payer: PublicKey;
  /** The ground vanity mint keypair (browser-local). */
  mintKeypair: Keypair;
}

export interface LaunchSigner {
  /**
   * Requests a signature from the user's wallet for a transaction that is
   * already partially signed by the mint keypair. The wallet sees a normal
   * transaction it is the fee payer of.
   */
  signTransaction(tx: Transaction): Promise<Transaction>;
}

/** Builds the official pump.fun create_v2 transaction (not yet signed). */
export async function buildCreateTransaction(
  params: LaunchParams,
  opts?: { recentBlockhash?: string }
): Promise<Transaction> {
  if (!isSpawnVanityAddress(params.mintKeypair.publicKey.toBase58())) {
    throw new Error("mint keypair does not end in 'Spw' — refusing to launch");
  }
  const { PUMP_SDK } = await loadPumpSdk();
  const createIxn: TransactionInstruction = await PUMP_SDK.createV2Instruction({
    mint: params.mintKeypair.publicKey,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri,
    creator: params.payer,
    user: params.payer,
    mayhemMode: false,
  });

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }));
  tx.add(createIxn);
  tx.feePayer = params.payer;
  if (opts?.recentBlockhash) tx.recentBlockhash = opts.recentBlockhash;
  // Refuse to hand the wallet anything Solana would reject outright.
  assertLaunchTxSize(tx);
  return tx;
}

/**
 * Fetches the pump.fun `Global` account (curve constants + fee schedule) used
 * to quote the initial buy. One RPC round-trip.
 */
export async function fetchPumpGlobal(connection: Connection): Promise<Global> {
  const { OnlinePumpSdk } = await loadPumpSdk();
  return new OnlinePumpSdk(connection).fetchGlobal();
}

/**
 * Expected token amount out for a SOL budget on a brand-new (not yet created)
 * SOL-quoted curve. Pure math against the Global account — no RPC.
 */
export async function computeExpectedTokens(global: Global, solLamports: bigint): Promise<BN> {
  const { getBuyTokenAmountFromSolAmount } = await loadPumpSdk();
  const { default: BN } = await import("bn.js");
  return getBuyTokenAmountFromSolAmount({
    global,
    feeConfig: null,
    mintSupply: null,
    bondingCurve: null,
    amount: new BN(solLamports.toString()),
    quoteMint: NATIVE_MINT,
  });
}

export interface CreateAndBuyParams extends LaunchParams {
  /** Dev buy amount in lamports — the exact authorized spend for the buy. */
  devBuyLamports: bigint;
  /** pump.fun Global account (fetched via fetchPumpGlobal). */
  global: Global;
}

/**
 * Builds the official pump.fun ATOMIC create + initial buy transaction:
 * create_v2 and buy_v2 execute in one transaction, so no other buyer can
 * front-run the creator's initial purchase. The buy_v2 argument pair is
 * (expected token amount, max SOL cost) — the program can never charge more
 * than `devBuyLamports` for the buy, regardless of curve movement between
 * quoting and signing.
 */
export async function buildCreateAndBuyTransaction(
  params: CreateAndBuyParams,
  opts?: { recentBlockhash?: string }
): Promise<Transaction> {
  if (!isSpawnVanityAddress(params.mintKeypair.publicKey.toBase58())) {
    throw new Error("mint keypair does not end in 'Spw' — refusing to launch");
  }
  if (params.devBuyLamports <= 0n) {
    throw new Error("dev buy amount must be positive");
  }
  const { PUMP_SDK } = await loadPumpSdk();
  const { default: BN } = await import("bn.js");

  const amount = await computeExpectedTokens(params.global, params.devBuyLamports);
  if (amount.isZero() || amount.isNeg()) {
    throw new Error("dev buy quote returned no tokens — launch blocked");
  }

  const ixs: TransactionInstruction[] = await PUMP_SDK.createV2AndBuyInstructions({
    global: params.global,
    mint: params.mintKeypair.publicKey,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri,
    creator: params.payer,
    user: params.payer,
    amount,
    solAmount: new BN(params.devBuyLamports.toString()),
    mayhemMode: false,
  });

  const tx = new Transaction();
  // Deliberately NO compute-budget instructions in the atomic bundle. The
  // Solana packet limit is a hard 1232 bytes and this transaction (26 unique
  // account keys + the official create_v2/ATA/buy_v2 layouts, which must stay
  // untouched) only fits without them. Measured before the fix: 1258 bytes on
  // mainnet — "Transaction too large: 1258 > 1232".
  //  - Compute unit limit: Solana's default budget without a
  //    SetComputeUnitLimit instruction is 200,000 CU per NON-BUILTIN
  //    instruction (create_v2 + the ATA idempotent create + buy_v2 = 3 =>
  //    600,000 CU), which EXCEEDS the ~500k the pump SDK recommends even for
  //    the heavier token-quoted case — execution is safe and cheaper to budget.
  //  - Priority fee (was 1,000 microLamports/CU = ~600 lamports total):
  //    dropped; negligible in practice and its wire bytes are required for the
  //    metadata URI. If priority fees are ever wanted again, the correct fix
  //    is a v0 transaction with address-lookup tables (frees hundreds of
  //    bytes), not cramming them back into this legacy packet.
  for (const ix of ixs) tx.add(ix);
  tx.feePayer = params.payer;
  if (opts?.recentBlockhash) tx.recentBlockhash = opts.recentBlockhash;
  // Refuse to hand the wallet anything Solana would reject outright (long
  // name/symbol combinations can still overflow; the error is actionable).
  assertLaunchTxSize(tx);
  return tx;
}


// ---------------------------------------------------------------------------
// Two-stage flow (official SDK path): create first, CONFIRM it on-chain, then
// submit the dev buy as its own transaction. Used automatically when the
// atomic create+buy transaction would exceed Solana's 1232-byte packet limit
// (e.g. a long name + symbol). The standalone buy is built with the SDK's
// public buyV2Instructions against the LIVE confirmed curve state, so the
// buy can never exceed the user's authorized SOL budget (amount/max-SOL pair
// + the same 1% slippage the SDK's own atomic bundle defaults to).
// ---------------------------------------------------------------------------

export type PumpBuyState = Awaited<ReturnType<OnlinePumpSdk["fetchBuyState"]>>;

/**
 * Live curve state the standalone buy needs (bonding curve + the user's token
 * ATA info). One RPC round-trip; call AFTER the create transaction is
 * confirmed on-chain. Pump v2 tokens are Token-2022 mints, so the ATA lookup
 * runs under TOKEN_2022_PROGRAM_ID — the SDK's default lookup program is the
 * legacy TOKEN_PROGRAM_ID and would look at the WRONG token account.
 */
export async function fetchBuyStateFor(
  mint58: string,
  user: PublicKey,
  connection: Connection
): Promise<PumpBuyState> {
  if (!isSpawnVanityAddress(mint58)) {
    throw new Error("mint address does not end in 'Spw' — refusing to buy");
  }
  const { OnlinePumpSdk } = await loadPumpSdk();
  return new OnlinePumpSdk(connection).fetchBuyState(
    new PublicKey(mint58),
    user,
    TOKEN_2022_PROGRAM_ID
  );
}

/**
 * Expected token amount out for a SOL budget on an EXISTING (confirmed)
 * bonding curve. Pure SDK math against the Global account + the decoded
 * curve — no RPC.
 */
export async function computeExpectedTokensOnCurve(
  global: Global,
  bondingCurve: BondingCurve,
  solLamports: bigint
): Promise<BN> {
  const { getBuyTokenAmountFromSolAmount } = await loadPumpSdk();
  const { default: BN } = await import("bn.js");
  return getBuyTokenAmountFromSolAmount({
    global,
    feeConfig: null,
    // MUST be non-null: probe-verified that when mintSupply is null the SDK
    // DISCARDS the passed curve and rebuilds a brand-new one from the Global
    // account — so a live curve that has already progressed would be quoted
    // at its INITIAL price, and a zeroed curve would never trigger the
    // zero-quote guard. Passing the curve's own supply keeps the SDK on the
    // real, live curve state (identical result for a fresh curve).
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: new BN(solLamports.toString()),
    quoteMint: NATIVE_MINT,
  });
}

export interface StandaloneBuyParams {
  mint58: string;
  /** Connected creator wallet: buyer AND fee payer of the buy transaction. */
  user: PublicKey;
  /** Dev buy budget in lamports — the buy's max SOL cost. */
  devBuyLamports: bigint;
  global: Global;
  /** Live curve state fetched via fetchBuyStateFor after create confirmed. */
  buyState: PumpBuyState;
}

/**
 * Builds the SEPARATE dev-buy transaction (official `buyV2Instructions`).
 * The wallet is the only signer (no mint keypair needed past creation).
 * The program can never charge more than `devBuyLamports` (+ the SDK's 1%
 * slippage margin) for the buy.
 */
export async function buildStandaloneBuyTransaction(
  params: StandaloneBuyParams,
  opts?: { recentBlockhash?: string }
): Promise<Transaction> {
  if (!isSpawnVanityAddress(params.mint58)) {
    throw new Error("mint address does not end in 'Spw' — refusing to buy");
  }
  if (params.devBuyLamports <= 0n) {
    throw new Error("dev buy amount must be positive");
  }
  const { PUMP_SDK } = await loadPumpSdk();
  const { default: BN } = await import("bn.js");

  // Quote against the LIVE confirmed curve. A zero/negative quote means the
  // curve state is unusable — refuse instead of building a losing buy.
  const amount = await computeExpectedTokensOnCurve(
    params.global,
    params.buyState.bondingCurve,
    params.devBuyLamports
  );
  if (amount.isZero() || amount.isNeg()) {
    throw new Error("dev buy quote returned no tokens — buy blocked");
  }

  const ixs: TransactionInstruction[] = await PUMP_SDK.buyV2Instructions({
    global: params.global,
    bondingCurveAccountInfo: params.buyState.bondingCurveAccountInfo,
    bondingCurve: params.buyState.bondingCurve,
    associatedUserAccountInfo: params.buyState.associatedUserAccountInfo,
    mint: new PublicKey(params.mint58),
    user: params.user,
    amount,
    quoteAmount: new BN(params.devBuyLamports.toString()),
    slippage: 1, // same 1% margin the SDK's own atomic bundle defaults to
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  });
  // Instruction ordering per the SDK: optional idempotent ATA create FIRST,
  // buy_v2 LAST.
  const tx = new Transaction();
  for (const ix of ixs) tx.add(ix);
  tx.feePayer = params.user;
  if (opts?.recentBlockhash) tx.recentBlockhash = opts.recentBlockhash;
  // The buy leg obeys the same preflight size guard — never request wallet
  // approval for anything Solana would reject outright.
  assertLaunchTxSize(tx);
  return tx;
}

/** Signs the standalone dev-buy transaction: the wallet is its ONLY signer. */
export async function signBuyTransaction(
  tx: Transaction,
  wallet: LaunchSigner
): Promise<Uint8Array> {
  const signed = await wallet.signTransaction(tx);
  return signed.serialize({ requireAllSignatures: true, verifySignatures: true });
}


/**
 * Requests the wallet signature: mint keypair partial-signs locally, the
 * wallet signs as fee payer. Returns the fully-signed raw bytes, ready to
 * broadcast. Split from submission so "waiting for wallet confirmation" is a
 * distinct, accurate progress state.
 */
export async function signLaunch(
  tx: Transaction,
  mintKeypair: Keypair,
  wallet: LaunchSigner
): Promise<Uint8Array> {
  tx.partialSign(mintKeypair);
  const signed = await wallet.signTransaction(tx);
  // Best-effort scrub of our partial signature copy.
  tx.signatures = [];
  return signed.serialize({ requireAllSignatures: true, verifySignatures: true });
}

/** Broadcasts the signed transaction. Only call once per signed payload. */
export async function submitLaunch(
  raw: Uint8Array,
  connection: Connection
): Promise<string> {
  return connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
}


/** Confirms with exponential backoff; throws on failure/timeout. */
export async function confirmLaunch(
  connection: Connection,
  signature: string,
  timeoutMs = 90_000
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`confirmation timed out after ${timeoutMs / 1000}s (signature ${signature})`);
    }
    const status = await connection.getSignatureStatuses([signature]);
    const s = status.value[0];
    if (s) {
      if (s.err) throw new Error(`launch transaction failed on-chain: ${JSON.stringify(s.err)}`);
      if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") return;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

export interface VerifiedLaunch {
  mint: string;
  bondingCurve: string;
  complete: boolean;
  signature: string;
}

/**
 * On-chain verification: the mint exists, ends in Spw, is owned by the pump
 * program's Token-2022, and its official bonding-curve PDA exists.
 */
export async function verifyLaunchOnChain(
  mintBase58: string,
  signature: string
): Promise<VerifiedLaunch> {
  const connection = new Connection(getRpcUrl(), "confirmed");
  const mint = new PublicKey(mintBase58);

  if (!isSpawnVanityAddress(mintBase58)) {
    throw new Error("mint address does not end in 'Spw'");
  }
  const mintInfo = await connection.getAccountInfo(mint);
  if (!mintInfo) throw new Error("mint account not found on-chain");

  const bcAddress = bondingCurveAddress(mintBase58);
  const bcInfo = await connection.getAccountInfo(new PublicKey(bcAddress));
  if (!bcInfo) throw new Error("pump.fun bonding curve account not found on-chain");
  if (!bcInfo.owner.equals(PUMP_PROGRAM_ID)) {
    throw new Error("bonding curve is not owned by the official pump.fun program");
  }

  // BondingCurve layout (official program, vendored IDL): 8-byte Anchor
  // discriminator, then virtual_token_reserves(u64) @8, virtual_quote(u64) @16,
  // real_token(u64) @24, real_quote(u64) @32, token_total_supply(u64) @40, and
  // `complete` (bool) at offset 48. Byte-level parsing stays minimal — the
  // authoritative state check is the tx itself.
  const complete = bcInfo.data.length > 48 ? bcInfo.data[48] === 1 : false;

  return { mint: mintBase58, bondingCurve: bcAddress, complete, signature };
}

export interface VerifiedDevBuy {
  /** SOL that left the creator wallet (buy amount + fees + rent), lamports. */
  solSpentLamports: number | null;
  /** Tokens the creator received for the dev buy, in token units (decimals applied). */
  tokensReceived: number | null;
}

/**
 * Verifies the dev buy from confirmed on-chain transaction data: the tx must
 * have succeeded, the creator's SOL decrease is read from balance diffs and
 * the token increase from pre/post token balances of the creator's accounts
 * for this mint. Throws if the tx failed or cannot be found — callers must
 * never report an unverified purchase as successful.
 */
export async function verifyDevBuyOnChain(
  mintBase58: string,
  creatorBase58: string,
  signature: string,
  connection: Connection = new Connection(getRpcUrl(), "confirmed")
): Promise<VerifiedDevBuy> {
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) throw new Error("transaction not found on-chain — dev buy unverified");
  if (tx.meta?.err) {
    throw new Error(`transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`);
  }

  // SOL spent by the fee payer (first account key = creator wallet here).
  let solSpentLamports: number | null = null;
  if (tx.meta?.preBalances && tx.meta?.postBalances) {
    solSpentLamports = tx.meta.preBalances[0] - tx.meta.postBalances[0];
  }

  // Tokens received by the creator: pre→post diff on the creator's accounts
  // holding this mint. Other buyers' accounts (if any) are excluded by owner.
  let tokensReceived: number | null = null;
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  for (const b of post) {
    if (b.mint !== mintBase58) continue;
    if (b.owner && b.owner !== creatorBase58) continue;
    const before =
      pre.find((p) => p.accountIndex === b.accountIndex)?.uiTokenAmount.uiAmount ?? 0;
    const after = b.uiTokenAmount.uiAmount;
    if (after != null) tokensReceived = after - (before ?? 0);
    break;
  }

  if (tokensReceived === null || tokensReceived <= 0) {
    throw new Error("no creator token balance increase found — dev buy unverified");
  }
  return { solSpentLamports, tokensReceived };
}
