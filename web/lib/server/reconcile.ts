/**
 * Server-side launch reconciliation.
 *
 * Recovery path for launches whose client-side registration POST failed
 * (dev-server recompile, transient network error, rate limit). SpawnPad
 * re-derives everything from the chain — never from client claims:
 *
 *  1. If a verified record already exists for the mint, return it (idempotent,
 *     no duplicates).
 *  2. If the client supplied the create signature, verify it directly.
 *  3. Otherwise locate the create signature by scanning the bonding curve's
 *     transaction history BACKWARDS (the create is the curve's first tx) with
 *     hard bounds: max 2 pages x 100 signatures, max 6 transaction fetches.
 *  4. Run the full server verification (verifyLaunchSubmission) on the found
 *     signature.
 *  5. Persist ONLY verified records, deduplicated by mint. Token metadata
 *     comes from the client when provided (already-validated lengths) or is
 *     decoded from the mint's own Token-2022 embedded metadata — never
 *     fabricated.
 *
 * Bounded by design: no unbounded polling, no retry loops, no uncontrolled
 * RPC fan-out.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  bondingCurveAddress,
  isSpawnVanityAddress,
  getRpcUrl,
} from "@/lib/config";
import { verifyLaunchSubmission } from "@/lib/server/verify";
import { getLaunch, upsertLaunch, type LaunchRecord } from "@/lib/server/store";
import { decodedToken2022Metadata } from "@/lib/server/metadata-tlv";
import { parsedTxIsSpawnCreate } from "@/lib/server/tx-inspect";

/** Hard caps — reconciliation never scans more than this. */
const MAX_HISTORY_PAGES = 2;
const PAGE_SIZE = 100;
const MAX_TX_FETCHES = 6;

export interface ReconcileInput {
  mint: string;
  /** Create-transaction signature when the client still knows it. */
  signature?: string;
  name?: string;
  symbol?: string;
  uri?: string;
  creator?: string;
  network: string;
}

export type ReconcileResult =
  | { ok: true; record: LaunchRecord; alreadyListed: boolean }
  | { ok: false; reason: string; alreadyListed?: false };

/**
 * Locates the pump.fun create signature for a mint by paging the bonding
 * curve's history backwards. Returns null when not found within bounds.
 */
export async function findCreateSignature(
  connection: Connection,
  mint58: string,
  opts?: { maxPages?: number; maxTxFetches?: number }
): Promise<string | null> {
  const maxPages = opts?.maxPages ?? MAX_HISTORY_PAGES;
  const maxTxFetches = opts?.maxTxFetches ?? MAX_TX_FETCHES;
  const bc = new PublicKey(bondingCurveAddress(mint58));
  let before: string | undefined;
  let candidates: string[] = [];
  for (let page = 0; page < maxPages; page++) {
    const sigs = await connection.getSignaturesForAddress(bc, {
      limit: PAGE_SIZE,
      ...(before ? { before } : {}),
    });
    if (sigs.length === 0) break;
    // Oldest-first candidates from the OLDEST page seen (skip failed txs —
    // a create always lands successfully).
    const oldestFirst = [...sigs].reverse();
    if (sigs.length < PAGE_SIZE || page === maxPages - 1) {
      candidates = oldestFirst
        .filter((s) => !s.err)
        .map((s) => s.signature);
    }
    before = sigs[sigs.length - 1].signature;
    if (sigs.length < PAGE_SIZE) break; // history exhausted
  }
  let fetches = 0;
  for (const sig of candidates) {
    if (fetches >= maxTxFetches) break;
    fetches++;
    let tx;
    try {
      tx = await connection.getParsedTransaction(sig, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
    } catch {
      continue; // transient RPC issue — try the next candidate
    }
    if (!tx) continue;
    const check = parsedTxIsSpawnCreate(tx, mint58);
    if (check.isCreate) return sig;
  }
  return null;
}

/**
 * Reconciles a launch: verifies on-chain and persists the verified record.
 * Never writes unverified data; never creates duplicates.
 */
export async function reconcileLaunch(input: ReconcileInput): Promise<ReconcileResult> {
  const { mint, network } = input;
  if (!isSpawnVanityAddress(mint)) {
    return { ok: false, reason: "mint does not end in 'Spw'" };
  }

  const existing = getLaunch(mint);
  if (existing?.status === "verified") {
    return { ok: true, record: existing, alreadyListed: true };
  }

  const connection = new Connection(getRpcUrl(), "confirmed");

  let signature = input.signature;
  if (signature) {
    const direct = await verifyLaunchSubmission({ mint, signature, network });
    if (!direct.ok) return { ok: false, reason: direct.reason ?? "verification failed" };
  } else {
    const found = await findCreateSignature(connection, mint);
    if (!found) {
      return {
        ok: false,
        reason: "launch transaction not found on-chain yet — the token may still be indexing; retry later",
      };
    }
    signature = found;
    const viaFound = await verifyLaunchSubmission({ mint, signature, network });
    if (!viaFound.ok) return { ok: false, reason: viaFound.reason ?? "verification failed" };
  }

  // Metadata: prefer client-provided values (validated), fall back to the
  // mint's own Token-2022 embedded metadata. Never invent data.
  let name = input.name;
  let symbol = input.symbol;
  let uri = input.uri;
  if (!name || !symbol || !uri) {
    try {
      const mintInfo = await connection.getAccountInfo(new PublicKey(mint));
      const meta = mintInfo ? decodedToken2022Metadata(mintInfo.data, new PublicKey(mint).toBytes()) : null;
      if (meta) {
        name = name || meta.name;
        symbol = symbol || meta.symbol;
        uri = uri || meta.uri;
      }
    } catch {
      /* metadata decoding is best-effort; verification already succeeded */
    }
  }
  if (!name || !symbol) {
    return { ok: false, reason: "token metadata unavailable — cannot list without a verifiable name/symbol" };
  }

  // LaunchedAt from the chain (blockTime), not the client clock.
  let launchedAt = Date.now();
  try {
    const parsed = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (parsed?.blockTime) launchedAt = parsed.blockTime * 1000;
  } catch {
    /* keep client-clock fallback */
  }

  const record: LaunchRecord = {
    mint,
    signature,
    name,
    symbol,
    uri,
    creator: input.creator,
    network,
    launchedAt,
    verifiedAt: Date.now(),
    status: "verified",
    bondingCurve: bondingCurveAddress(mint),
  };
  return { ok: true, record: upsertLaunch(record), alreadyListed: false };
}