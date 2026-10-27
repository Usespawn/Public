/**
 * Server-side helpers for the Pump.fun bonding-curve phase (server-only):
 * real on-chain curve reads and a real cached SOL/USD quote. USD is NEVER
 * fabricated — when no genuine SOL/USD quote is available it stays null.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { bondingCurveAddress, getRpcUrl } from "@/lib/config";
import { createTtlCache, createRateBudget, UpstreamRateLimitedError } from "@/lib/market/cache";
import { createDexScreenerClient } from "@/lib/market/providers/dexscreener";
import { decodeBondingCurveState, type BondingCurveState } from "@/lib/market/pump-curve";

const PUMP_PROGRAM_58 = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const connection = new Connection(getRpcUrl(), "confirmed");
const dex = createDexScreenerClient({ fetchImpl: fetch });
const solUsdBudget = createRateBudget(6); // ≤6 SOL/USD refreshes per minute
/** Real SOL/USD quote, cached 5 min, single-flight. */
const solUsdCache = createTtlCache<number | null>();

/** Real on-chain bonding-curve state for a mint (RPC read). */
export async function fetchCurveState(mint: string): Promise<BondingCurveState> {
  try {
    const bc = new PublicKey(bondingCurveAddress(mint));
    const info = await connection.getAccountInfo(bc);
    if (!info || info.owner.toBase58() !== PUMP_PROGRAM_58) {
      return decodeBondingCurveState(null);
    }
    return decodeBondingCurveState(info.data);
  } catch {
    return decodeBondingCurveState(null);
  }
}

/** Real SOL/USD via DexScreener's deepest WSOL pair (cached, budgeted). */
export async function fetchSolUsd(): Promise<number | null> {
  try {
    const entry = await solUsdCache.fetchThrough("sol-usd", 5 * 60_000, async () => {
      if (!solUsdBudget.tryConsume()) throw new UpstreamRateLimitedError(null);
      const stats = await dex.bestPairStats(
        "So11111111111111111111111111111111111111112"
      );
      return stats?.priceUsd ?? null;
    });
    return entry.value;
  } catch {
    return null; // honest null — curve USD is simply omitted this round
  }
}