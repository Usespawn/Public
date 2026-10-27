/**
 * On-chain Pump.fun bonding-curve price fallback (zero "@/" imports).
 *
 * When no market-data provider has indexed a fresh launch yet, the bonding
 * curve's own reserves still yield a REAL price — this is not an estimate:
 *   priceSOL = (virtual_sol_reserves / 1e9) / (virtual_token_reserves / 1e6)
 * using the virtual reserves exactly as the bonding-curve program prices
 * trades. USD conversion requires a REAL external SOL/USD quote passed in by
 * the caller — this module never invents one.
 *
 * Account layout (official pump program, vendored IDL):
 *   [0..8)   Anchor discriminator
 *   [8..16)  virtual_token_reserves  u64 LE (token raw, 6 decimals)
 *   [16..24) virtual_sol_reserves    u64 LE (lamports)
 *   [24..32) real_token_reserves     u64 LE
 *   [32..40) real_sol_reserves       u64 LE
 *   [40..48) token_total_supply      u64 LE
 *   [48]     complete                bool (1 = graduated)
 */
export interface BondingCurveState {
  exists: boolean;
  /** True when the curve has completed (token graduated). */
  complete: boolean | null;
  /** SOL per 1 token (6-decimal token), from virtual reserves; null if n/a. */
  priceSOL: number | null;
  virtualTokenReserves: bigint | null;
  virtualSolReserves: bigint | null;
}

const TOKEN_DECIMALS = 6;
const SOL_DECIMALS = 9;

export function decodeBondingCurveState(data: Uint8Array | null | undefined): BondingCurveState {
  if (!data || data.length < 49) {
    return { exists: false, complete: null, priceSOL: null, virtualTokenReserves: null, virtualSolReserves: null };
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // u64 LE reads via BigInt (values routinely exceed Number.MAX_SAFE_INTEGER)
  const vToken = view.getBigUint64(8, true);
  const vSol = view.getBigUint64(16, true);
  const complete = data[48] === 1;
  let priceSOL: number | null = null;
  if (vToken > 0n) {
    const tokens = Number(vToken) / 10 ** TOKEN_DECIMALS;
    const sol = Number(vSol) / 10 ** SOL_DECIMALS;
    if (Number.isFinite(tokens) && Number.isFinite(sol) && tokens > 0) {
      priceSOL = sol / tokens;
    }
  }
  return {
    exists: true,
    complete,
    priceSOL,
    virtualTokenReserves: vToken,
    virtualSolReserves: vSol,
  };
}

/** USD price from a real SOL/USD quote (never fabricated here). */
export function curvePriceUsd(priceSOL: number | null, solUsd: number | null): number | null {
  if (priceSOL == null || solUsd == null || !Number.isFinite(solUsd) || solUsd <= 0) {
    return null;
  }
  return priceSOL * solUsd;
}