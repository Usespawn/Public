/**
 * Dev Buy configuration, validation and estimation.
 *
 * Pure functions only — no RPC, no React, no wallet. Everything here is
 * deterministic and unit-tested. The dev buy spends the CREATOR's connected
 * wallet; SpawnPad never holds or moves funds itself.
 */
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

/** Preset purchase amounts (SOL) — mirrors the pump.fun-style initial buy. */
export const DEV_BUY_PRESETS_SOL = [0.01, 0.05, 0.1, 0.5] as const;

/** Reasonable purchase limits. */
export const DEV_BUY_MIN_SOL = 0.01;
export const DEV_BUY_MAX_SOL = 5;

/**
 * Fixed overhead (lamports) beyond the selected buy amount:
 *  - transaction signature fee: 2 signatures ≈ 10,000 lamports
 *  - priority fee: 500,000 CU cap × 1,000 microLamports = 500,000 lamports
 *  - Token-2022 creator ATA rent (created by the buy) ≈ 2,100,000 lamports
 * These are estimates; the wallet shows the exact figures at signing time.
 */
export const TX_FEE_LAMPORTS = 10_000n;
export const PRIORITY_FEE_ESTIMATE_LAMPORTS = 500_000n;
export const ATA_RENT_ESTIMATE_LAMPORTS = 2_100_000n;
export const DEV_BUY_OVERHEAD_LAMPORTS =
  TX_FEE_LAMPORTS + PRIORITY_FEE_ESTIMATE_LAMPORTS + ATA_RENT_ESTIMATE_LAMPORTS;

export interface DevBuyValidation {
  ok: boolean;
  error?: string;
  /** Authorized purchase amount in lamports (valid inputs only). */
  lamports?: bigint;
}

/**
 * Validates a dev buy amount and, when a balance is provided, ensures the
 * purchase plus overhead fits. Never mutates or "fixes" the user's amount —
 * an invalid amount is rejected, not adjusted.
 */
export function validateDevBuyAmount(
  sol: number,
  balanceLamports?: number | null
): DevBuyValidation {
  if (typeof sol !== "number" || !Number.isFinite(sol)) {
    return { ok: false, error: "Enter a valid SOL amount" };
  }
  if (sol <= 0) {
    return { ok: false, error: "SOL amount must be greater than zero" };
  }
  if (sol < DEV_BUY_MIN_SOL) {
    return { ok: false, error: `Minimum dev buy is ${DEV_BUY_MIN_SOL} SOL` };
  }
  if (sol > DEV_BUY_MAX_SOL) {
    return { ok: false, error: `Maximum dev buy is ${DEV_BUY_MAX_SOL} SOL` };
  }
  // Rounding to whole lamports — sub-lamport dust is folded, never accumulated.
  const lamports = BigInt(Math.round(sol * LAMPORTS_PER_SOL));
  if (balanceLamports != null) {
    const required = lamports + DEV_BUY_OVERHEAD_LAMPORTS;
    if (required > BigInt(Math.floor(balanceLamports))) {
      return {
        ok: false,
        error: `Insufficient balance: dev buy + fees + rent needs ≥ ${(Number(required) / LAMPORTS_PER_SOL).toFixed(5)} SOL`,
      };
    }
  }
  return { ok: true, lamports };
}

export interface DevBuyEstimate {
  /** Selected purchase amount (lamports). */
  buyLamports: bigint;
  /** Fees + rent estimate (lamports), separate from the buy amount. */
  overheadLamports: bigint;
  /** Total that must be available in the wallet (lamports). */
  totalLamports: bigint;
}

export function estimateDevBuyTotals(sol: number): DevBuyEstimate {
  const buyLamports = BigInt(Math.round(sol * LAMPORTS_PER_SOL));
  return {
    buyLamports,
    overheadLamports: DEV_BUY_OVERHEAD_LAMPORTS,
    totalLamports: buyLamports + DEV_BUY_OVERHEAD_LAMPORTS,
  };
}

/** Formats lamports as a SOL string with at most 5 decimals, no trailing zeros. */
export function formatSol(lamports: bigint | number): string {
  const v = Number(lamports) / LAMPORTS_PER_SOL;
  return String(parseFloat(v.toFixed(5)));
}
