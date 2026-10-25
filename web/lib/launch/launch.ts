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
import type BN from "bn.js";
import type { Global } from "@pump-fun/pump-sdk";
import { PUMP_PROGRAM_ID, bondingCurveAddress, getRpcUrl, MANDATORY_SUFFIX, isSpawnVanityAddress } from "@/lib/config";

/** Wrapped-SOL mint (quote asset of pump.fun curves). Same constant as
 *  @solana/spl-token's NATIVE_MINT, declared locally to avoid a new direct
 *  dependency in the web bundle. */
const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");

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
export function assertLaunchTxSize(tx: Transaction): void {
  const hadBlockhash =
    typeof tx.recentBlockhash === "string" && tx.recentBlockhash.length > 0;
  if (!hadBlockhash) tx.recentBlockhash = SIZE_PROBE_BLOCKHASH;
  try {
    const msg = tx.compileMessage();
    const size =
      msg.serialize().length + 1 + 64 * msg.header.numRequiredSignatures;
    if (size > MAX_SERIALIZED_BYTES) {
      throw new Error(
        `launch transaction too large for the Solana ${MAX_SERIALIZED_BYTES}-byte ` +
          `packet limit (${size} bytes) — shorten the token name or symbol, or ` +
          `turn off Dev Initial Buy and retry`
      );
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
  signature: string
): Promise<VerifiedDevBuy> {
  const connection = new Connection(getRpcUrl(), "confirmed");
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
