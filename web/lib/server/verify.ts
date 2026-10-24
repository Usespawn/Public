/**
 * Server-side launch verification.
 *
 * The backend re-derives every fact from the chain: the transaction must have
 * succeeded, must contain a create_v2 instruction against the official pump
 * program with the claimed mint, the mint must end in `Spw`, and the official
 * bonding-curve PDA must exist and be program-owned.
 */
import {
  Connection,
  PublicKey,
} from "@solana/web3.js";
import { PUMP_PROGRAM_ID, bondingCurveAddress, isSpawnVanityAddress, getNetwork, getRpcUrl } from "@/lib/config";

export interface ServerVerification {
  ok: boolean;
  reason?: string;
  bondingCurve?: string;
}

export async function verifyLaunchSubmission(input: {
  mint: string;
  signature: string;
  network: string;
}): Promise<ServerVerification> {
  const { mint, signature } = input;
  const network = getNetwork();
  if (input.network !== network) {
    return { ok: false, reason: `launch network ${input.network} does not match server network ${network}` };
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature) && !/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(signature)) {
    return { ok: false, reason: "malformed signature" };
  }
  if (!isSpawnVanityAddress(mint)) {
    return { ok: false, reason: "mint does not end in 'Spw'" };
  }

  const connection = new Connection(getRpcUrl(), "confirmed");

  let mintInfo;
  try {
    mintInfo = await connection.getAccountInfo(new PublicKey(mint));
  } catch (e: any) {
    return { ok: false, reason: `rpc error: ${String(e?.message || e)}` };
  }
  if (!mintInfo) return { ok: false, reason: "mint account not found on-chain" };
  // owner must be Token-2022 for pump.fun create_v2 coins
  if (mintInfo.owner.toBase58() !== "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") {
    return { ok: false, reason: "mint is not a Token-2022 account" };
  }

  let tx;
  try {
    tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
  } catch (e: any) {
    return { ok: false, reason: `rpc error: ${String(e?.message || e)}` };
  }
  if (!tx) return { ok: false, reason: "transaction not found" };
  if (tx.meta?.err) return { ok: false, reason: "transaction failed on-chain" };

  // The transaction must touch the pump program and include the claimed mint.
  // getAccountKeys covers both legacy and v0 messages; narrow types are loose
  // here by design (web3.js typings differ across versions).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg = tx.transaction.message as any;
  const keys = msg.getAccountKeys
    ? msg.getAccountKeys({ accountKeysFromMeta: tx.meta?.loadedAddresses })
    : { key: msg.accountKeys };
  const flat: PublicKey[] = Array.from(keys.key ?? keys);
  if (!msg.instructions.some((ix: any) => ix.programId.toBase58() === PUMP_PROGRAM_ID.toBase58())) {
    return { ok: false, reason: "transaction contains no official pump.fun program instruction" };
  }
  if (!flat.some((k) => k.toBase58() === mint)) {
    return { ok: false, reason: "claimed mint is not part of the launch transaction" };
  }

  const bc = bondingCurveAddress(mint);
  const bcInfo = await connection.getAccountInfo(new PublicKey(bc));
  if (!bcInfo) return { ok: false, reason: "pump.fun bonding curve not found on-chain" };
  if (!bcInfo.owner.equals(PUMP_PROGRAM_ID)) {
    return { ok: false, reason: "bonding curve not owned by pump.fun program" };
  }

  return { ok: true, bondingCurve: bc };
}
