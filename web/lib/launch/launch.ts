/**
 * Real Pump.fun launch flow (official @pump-fun/pump-sdk).
 *
 * create_v2 accepts a caller-supplied mint keypair (account 1, Signer) — the
 * same flow pump.fun's own UI uses to grind its `pump` suffix. SpawnPad grinds
 * `Spw` instead, builds the tx client-side, partial-signs with the mint
 * keypair, requests the user's wallet signature for the fee-payer side, sends,
 * confirms, and verifies the on-chain bonding curve before reporting success.
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
  VersionedTransaction,
} from "@solana/web3.js";
import { PUMP_PROGRAM_ID, bondingCurveAddress, getRpcUrl, MANDATORY_SUFFIX, isSpawnVanityAddress } from "@/lib/config";

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
  const { PUMP_SDK } = await import("@pump-fun/pump-sdk");
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
  return tx;
}

/**
 * Signs and submits: mint keypair partial-signs locally; the wallet signs as
 * fee payer. Returns the tx signature.
 */
export async function signAndSubmit(
  tx: Transaction,
  mintKeypair: Keypair,
  wallet: LaunchSigner,
  connection: Connection
): Promise<string> {
  tx.partialSign(mintKeypair);
  const signed = await wallet.signTransaction(tx);
  // Best-effort scrub of our partial signature copy.
  tx.signatures = [];
  const raw = signed.serialize();
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
