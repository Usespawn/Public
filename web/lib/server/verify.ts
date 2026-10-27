/**
 * Server-side launch verification.
 *
 * The backend re-derives every fact from the chain: the transaction must have
 * succeeded, must contain an official pump.fun create (v2) instruction that
 * references the claimed mint, the mint must have CO-SIGNED the transaction
 * (the SpawnPad vanity keypair always co-signs), the mint must end in `Spw`,
 * and the official bonding-curve PDA must exist and be program-owned.
 *
 * Implementation notes (v0-proof): pump-sdk launch transactions are VERSIONED.
 * getParsedTransaction is used because the RPC resolves address-lookup-table
 * keys server-side and exposes every instruction with an explicit programId —
 * this avoids both the v0 `programIdIndex` pitfall (ix.programId is undefined
 * on raw versioned messages) and unresolved-ALT failures. The pure decision
 * helpers live in tx-inspect.ts (unit-tested in tests/web/).
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  PUMP_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  bondingCurveAddress,
  isSpawnVanityAddress,
  getNetwork,
  getRpcUrl,
} from "@/lib/config";
import { parsedTxIsSpawnCreate } from "@/lib/server/tx-inspect";

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
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(signature)) {
    return { ok: false, reason: "malformed signature" };
  }
  if (!isSpawnVanityAddress(mint)) {
    return { ok: false, reason: "mint does not end in 'Spw'" };
  }

  const connection = new Connection(getRpcUrl(), "confirmed");

  let mintInfo;
  try {
    mintInfo = await connection.getAccountInfo(new PublicKey(mint));
  } catch (e: unknown) {
    return { ok: false, reason: `rpc error: ${String((e as Error)?.message || e)}` };
  }
  if (!mintInfo) return { ok: false, reason: "mint account not found on-chain" };
  // owner must be Token-2022 for pump.fun create_v2 coins
  if (mintInfo.owner.toBase58() !== TOKEN_2022_PROGRAM_ID.toBase58()) {
    return { ok: false, reason: "mint is not a Token-2022 account" };
  }

  let tx;
  try {
    tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
  } catch (e: unknown) {
    return { ok: false, reason: `rpc error: ${String((e as Error)?.message || e)}` };
  }
  if (!tx) return { ok: false, reason: "transaction not found" };

  const createCheck = parsedTxIsSpawnCreate(tx, mint);
  if (!createCheck.isCreate) {
    return { ok: false, reason: createCheck.reason ?? "transaction is not a pump.fun launch" };
  }

  const bc = bondingCurveAddress(mint);
  let bcInfo;
  try {
    bcInfo = await connection.getAccountInfo(new PublicKey(bc));
  } catch (e: unknown) {
    return { ok: false, reason: `rpc error: ${String((e as Error)?.message || e)}` };
  }
  if (!bcInfo) return { ok: false, reason: "pump.fun bonding curve not found on-chain" };
  if (!bcInfo.owner.equals(PUMP_PROGRAM_ID)) {
    return { ok: false, reason: "bonding curve not owned by pump.fun program" };
  }

  return { ok: true, bondingCurve: bc };
}
