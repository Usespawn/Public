//! Pure bonding-curve mathematics (Pump.fun V2-style virtual reserves).
//!
//! Everything here is allocation-free, deterministic and unit-testable without
//! a validator. All arithmetic uses `u128` intermediates with checked ops.
//!
//! Model (constant product, `x * y = k`, over *virtual* reserves):
//! - Buy:  `tokens_out = net_sol_in * virtual_token / (virtual_sol + net_sol)`
//! - Sell: `sol_out    = tokens_in * virtual_sol / (virtual_token + tokens_in)`
//! - A total fee (bps) is taken off the top of each trade and split between
//!   the protocol treasury and the token creator.

use crate::errors::SpawnError;
use anchor_lang::prelude::*;

/// Snapshot of a curve's reserves, used for pure-math quoting.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CurveReserves {
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
}

/// Fee decomposition of a trade (all values in the trade's units).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FeeSplit {
    /// Total fee taken (protocol_fee + creator_fee).
    pub total_fee: u64,
    /// Protocol treasury share.
    pub protocol_fee: u64,
    /// Token creator share.
    pub creator_fee: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BuyQuote {
    pub sol_in: u64,
    pub tokens_out: u64,
    pub fees: FeeSplit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SellQuote {
    pub tokens_in: u64,
    /// SOL produced by the curve before fees.
    pub sol_out_gross: u64,
    /// SOL actually received after fees.
    pub sol_out_net: u64,
    pub fees: FeeSplit,
}

/// Splits `gross` into (protocol, creator) fees. Requires
/// `total_fee_bps <= 10_000` and `creator_fee_bps <= 10_000` (validated in
/// the global config at init).
pub fn split_fee(gross: u64, total_fee_bps: u16, creator_fee_bps: u16) -> FeeSplit {
    let total_fee = ((gross as u128 * total_fee_bps as u128) / 10_000) as u64;
    let creator_fee = ((total_fee as u128 * creator_fee_bps as u128) / 10_000) as u64;
    FeeSplit {
        total_fee,
        protocol_fee: total_fee - creator_fee,
        creator_fee,
    }
}

/// Quote a buy: SOL in → tokens out, with the fee taken off the top.
pub fn quote_buy(
    reserves: &CurveReserves,
    sol_in: u64,
    total_fee_bps: u16,
    creator_fee_bps: u16,
) -> Result<BuyQuote> {
    if sol_in == 0 {
        return Err(error!(SpawnError::BuyTooSmall));
    }
    let fees = split_fee(sol_in, total_fee_bps, creator_fee_bps);
    let net_sol = sol_in
        .checked_sub(fees.total_fee)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    if net_sol == 0 {
        return Err(error!(SpawnError::BuyTooSmall));
    }

    let virtual_sol_after = (reserves.virtual_sol_reserves as u128)
        .checked_add(net_sol as u128)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    let tokens_out_u128 = (net_sol as u128)
        .checked_mul(reserves.virtual_token_reserves as u128)
        .and_then(|v| v.checked_div(virtual_sol_after))
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    let tokens_out = u64::try_from(tokens_out_u128).map_err(|_| error!(SpawnError::CurveOverflow))?;

    if tokens_out == 0 {
        return Err(error!(SpawnError::TokenAmountTooSmall));
    }
    if tokens_out > reserves.real_token_reserves {
        return Err(error!(SpawnError::InsufficientLiquidity));
    }

    Ok(BuyQuote {
        sol_in,
        tokens_out,
        fees,
    })
}

/// Apply a quoted buy to the reserves snapshot.
pub fn apply_buy(reserves: &mut CurveReserves, quote: &BuyQuote) -> Result<()> {
    let net_sol = quote
        .sol_in
        .checked_sub(quote.fees.total_fee)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;

    reserves.real_token_reserves = reserves
        .real_token_reserves
        .checked_sub(quote.tokens_out)
        .ok_or_else(|| error!(SpawnError::InsufficientLiquidity))?;
    reserves.real_sol_reserves = reserves
        .real_sol_reserves
        .checked_add(net_sol)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    reserves.virtual_token_reserves = reserves
        .virtual_token_reserves
        .checked_sub(quote.tokens_out)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    reserves.virtual_sol_reserves = reserves
        .virtual_sol_reserves
        .checked_add(net_sol)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    Ok(())
}

/// Quote a sell: tokens in → SOL out (net of fees).
pub fn quote_sell(
    reserves: &CurveReserves,
    tokens_in: u64,
    total_fee_bps: u16,
    creator_fee_bps: u16,
) -> Result<SellQuote> {
    if tokens_in == 0 {
        return Err(error!(SpawnError::TokenAmountTooSmall));
    }

    let virtual_token_after = (reserves.virtual_token_reserves as u128)
        .checked_add(tokens_in as u128)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    let sol_out_gross_u128 = (tokens_in as u128)
        .checked_mul(reserves.virtual_sol_reserves as u128)
        .and_then(|v| v.checked_div(virtual_token_after))
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    let sol_out_gross =
        u64::try_from(sol_out_gross_u128).map_err(|_| error!(SpawnError::CurveOverflow))?;

    if sol_out_gross == 0 {
        return Err(error!(SpawnError::SellTooSmall));
    }

    let fees = split_fee(sol_out_gross, total_fee_bps, creator_fee_bps);
    let sol_out_net = sol_out_gross
        .checked_sub(fees.total_fee)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;

    Ok(SellQuote {
        tokens_in,
        sol_out_gross,
        sol_out_net,
        fees,
    })
}

/// Apply a quoted sell to the reserves snapshot.
pub fn apply_sell(reserves: &mut CurveReserves, quote: &SellQuote) -> Result<()> {
    // The curve pays out the FULL gross — fees leave the curve with the payout,
    // so real SOL reserves must track the actual lamports leaving the account.
    reserves.real_sol_reserves = reserves
        .real_sol_reserves
        .checked_sub(quote.sol_out_gross)
        .ok_or_else(|| error!(SpawnError::InsufficientLiquidity))?;
    reserves.virtual_sol_reserves = reserves
        .virtual_sol_reserves
        .checked_sub(quote.sol_out_gross)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    reserves.real_token_reserves = reserves
        .real_token_reserves
        .checked_add(quote.tokens_in)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    reserves.virtual_token_reserves = reserves
        .virtual_token_reserves
        .checked_add(quote.tokens_in)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    Ok(())
}

/// Graduation check: real SOL reserves at/above the configured threshold.
pub fn is_graduated(reserves: &CurveReserves, graduation_threshold_lamports: u64) -> bool {
    reserves.real_sol_reserves >= graduation_threshold_lamports
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pump.fun-style fresh curve: 30 SOL of phantom SOL depth, 1.073B
    /// virtual tokens (793.1B real + 279.9B phantom).
    fn fresh_reserves() -> CurveReserves {
        CurveReserves {
            virtual_sol_reserves: 30_000_000_000,
            virtual_token_reserves: 1_073_000_000_000_000,
            real_sol_reserves: 0,
            real_token_reserves: 793_100_000_000_000,
        }
    }

    const FEE_BPS: u16 = 100; // 1%
    const CREATOR_BPS: u16 = 2_000; // 20% of the fee

    #[test]
    fn fee_split_exact() {
        let f = split_fee(1_000_000_000, FEE_BPS, CREATOR_BPS);
        assert_eq!(f.total_fee, 10_000_000);
        assert_eq!(f.creator_fee, 2_000_000);
        assert_eq!(f.protocol_fee, 8_000_000);
        assert_eq!(f.protocol_fee + f.creator_fee, f.total_fee);

        let zero = split_fee(0, FEE_BPS, CREATOR_BPS);
        assert_eq!((zero.total_fee, zero.protocol_fee, zero.creator_fee), (0, 0, 0));

        // 0.005 SOL → 50_000 lamports fee, creator gets 10_000.
        let tiny = split_fee(5_000_000, FEE_BPS, CREATOR_BPS);
        assert_eq!(tiny.total_fee, 50_000);
        assert_eq!(tiny.creator_fee, 10_000);
    }

    #[test]
    fn buy_quote_matches_constant_product() {
        let r = fresh_reserves();
        let q = quote_buy(&r, 1_000_000_000, FEE_BPS, CREATOR_BPS).unwrap();
        assert_eq!(q.fees.total_fee, 10_000_000);
        let net = 990_000_000u64;
        let expected =
            (net as u128 * r.virtual_token_reserves as u128) / ((r.virtual_sol_reserves + net) as u128);
        assert_eq!(q.tokens_out as u128, expected);

        // Virtual constant product: (vs + net) * (vt - out) >= vs * vt, with
        // rounding error strictly smaller than the post-trade virtual SOL.
        let product_before = r.virtual_sol_reserves as u128 * r.virtual_token_reserves as u128;
        let product_after = (r.virtual_sol_reserves as u128 + net as u128)
            * (r.virtual_token_reserves as u128 - q.tokens_out as u128);
        assert!(product_after >= product_before);
        assert!(product_after - product_before < r.virtual_sol_reserves as u128 + net as u128);
    }

    #[test]
    fn buy_then_sell_round_trips_without_loss_beyond_fees() {
        let mut r = fresh_reserves();
        let buy = quote_buy(&r, 1_000_000_000, FEE_BPS, CREATOR_BPS).unwrap();
        apply_buy(&mut r, &buy).unwrap();

        let sell = quote_sell(&r, buy.tokens_out, FEE_BPS, CREATOR_BPS).unwrap();
        // Selling the exact tokens bought returns ~the SOL spent (minus fees
        // and integer rounding), never more.
        assert!(sell.sol_out_gross <= 990_000_000);
        assert!(990_000_000 - sell.sol_out_gross < 1_000);
        assert!(sell.sol_out_net < sell.sol_out_gross);

        apply_sell(&mut r, &sell).unwrap();
        // The curve pays out the full gross (fees leave the curve), so the
        // round trip drains the real SOL reserves to integer-rounding dust.
        assert!(r.real_sol_reserves <= 2);
        // Tokens are exactly restocked.
        assert!(r.real_token_reserves >= 793_100_000_000_000 - 1_000);
        assert!(r.virtual_sol_reserves >= 30_000_000_000);
    }

    #[test]
    fn graduation_threshold_boundary() {
        let mut r = fresh_reserves();
        assert!(!is_graduated(&r, 85_000_000_000));
        r.real_sol_reserves = 84_999_999_999;
        assert!(!is_graduated(&r, 85_000_000_000));
        r.real_sol_reserves = 85_000_000_000;
        assert!(is_graduated(&r, 85_000_000_000));
    }

    #[test]
    fn buy_reaches_graduation_with_adaptive_buys() {
        let mut r = fresh_reserves();
        let threshold = 84_500_000_000u64;
        // Near full completion the remaining token inventory shrinks
        // geometrically, so buy sizes shrink too — mirroring real market
        // behaviour as the curve fills.
        let mut size = 5_000_000_000u64;
        let mut buys = 0;
        while !is_graduated(&r, threshold) {
            buys += 1;
            assert!(buys < 200, "graduation must be reachable in <200 buys");
            match quote_buy(&r, size, FEE_BPS, CREATOR_BPS) {
                Ok(q) => apply_buy(&mut r, &q).unwrap(),
                Err(_) => {
                    size /= 2;
                    assert!(size >= 1_000, "cannot make progress toward graduation");
                }
            }
        }
        assert!(r.real_sol_reserves >= threshold);
    }

    #[test]
    fn buy_rejects_when_curve_token_supply_exhausted() {
        let mut r = fresh_reserves();
        r.real_token_reserves = 1; // nearly exhausted
        let err = quote_buy(&r, 100_000_000_000, FEE_BPS, CREATOR_BPS).unwrap_err();
        assert!(
            err.to_string().contains("Insufficient liquidity"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn buy_rejects_zero_and_dust() {
        let r = fresh_reserves();
        assert!(quote_buy(&r, 0, FEE_BPS, CREATOR_BPS).is_err());
        // 1 lamport into a curve with huge SOL depth yields ~0 tokens.
        let degenerate = CurveReserves {
            virtual_sol_reserves: u64::MAX / 2,
            virtual_token_reserves: 1_073_000_000_000_000,
            real_sol_reserves: u64::MAX / 2,
            real_token_reserves: 793_100_000_000_000,
        };
        assert!(quote_buy(&degenerate, 1, FEE_BPS, CREATOR_BPS).is_err());
    }

    #[test]
    fn sell_rejects_zero_tokens() {
        let r = fresh_reserves();
        assert!(quote_sell(&r, 0, FEE_BPS, CREATOR_BPS).is_err());
    }

    #[test]
    fn sell_of_one_token_on_deep_curve_is_too_small() {
        let r = fresh_reserves();
        // 1 token out of 1.073e15 virtual tokens → 0 lamports gross.
        assert!(quote_sell(&r, 1, FEE_BPS, CREATOR_BPS).is_err());
    }

    #[test]
    fn sell_quote_math_is_exact() {
        let r = fresh_reserves();
        let tokens_in = 10_000_000_000_000u64; // 10M tokens
        let q = quote_sell(&r, tokens_in, FEE_BPS, CREATOR_BPS).unwrap();
        let expected_gross = (tokens_in as u128 * r.virtual_sol_reserves as u128)
            / ((r.virtual_token_reserves + tokens_in) as u128);
        assert_eq!(q.sol_out_gross as u128, expected_gross);
        assert_eq!(q.fees.total_fee, (expected_gross as u64) / 100); // 1% of gross
        assert_eq!(q.sol_out_net, q.sol_out_gross - q.fees.total_fee);
        assert_eq!(q.fees.protocol_fee + q.fees.creator_fee, q.fees.total_fee);
    }

    #[test]
    fn apply_buy_and_sell_keep_invariants() {
        let mut r = fresh_reserves();
        for gross in [50_000_000u64, 200_000_000, 1_000_000_000] {
            let q = quote_buy(&r, gross, FEE_BPS, CREATOR_BPS).unwrap();
            apply_buy(&mut r, &q).unwrap();
        }
        // Real token reserves decreased; real SOL grew by net buys.
        assert!(r.real_token_reserves < 793_100_000_000_000);
        assert!(r.real_sol_reserves > 0);
        // Virtual reserves always exceed real reserves (phantom depth intact).
        assert!(r.virtual_sol_reserves > r.real_sol_reserves);
        assert!(r.virtual_token_reserves > r.real_token_reserves);
    }
}
