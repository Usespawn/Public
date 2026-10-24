//! On-chain account state for the Spawnpad bonding curve engine.

use anchor_lang::prelude::*;

pub const TOKEN_DECIMALS: u8 = 6;
/// SPL mint account size.
pub const MINT_SPACE: usize = 82;
/// Enforced vanity suffix for every mint launched via Spawnpad.
pub const VANITY_SUFFIX: &str = "Spw";

// PDA seeds.
pub const CONFIG_SEED: &[u8] = b"global_config";
pub const CURVE_SEED: &[u8] = b"curve";
pub const CURVE_AUTHORITY_SEED: &[u8] = b"curve_authority";
pub const LOCK_SEED: &[u8] = b"locked_liquidity";
pub const LOCK_TOKEN_SEED: &[u8] = b"locked_token";

// Production defaults (all overridable in `initialize` / `update_config`).
/// Total trading fee: 100 bps = 1.00% of every buy & sell.
pub const DEFAULT_TOTAL_FEE_BPS: u16 = 100;
/// Creator share of the fee: 2000 bps of the fee = 20% (i.e. 0.20% of notional).
pub const DEFAULT_CREATOR_FEE_BPS: u16 = 2_000;
/// Graduation threshold: 84.5 SOL of real SOL reserves.
///
/// NOTE: with the pump.fun constants (30 SOL virtual SOL, 1.073B virtual
/// tokens, 793.1M real curve tokens) the curve is *fully* bought out at
/// exactly 85.0 SOL raised — the threshold must stay below that point so the
/// final buys always have inventory to fill. 84.5 SOL leaves headroom and
/// lands in the $10k–$60k market-cap graduation band depending on SOL price.
pub const DEFAULT_GRADUATION_THRESHOLD_LAMPORTS: u64 = 84_500_000_000;
/// Pump.fun-style initial virtual SOL (30 SOL phantom depth) for smooth
/// price discovery — real SOL starts at 0.
pub const DEFAULT_INITIAL_VIRTUAL_SOL_LAMPORTS: u64 = 30_000_000_000;
/// Pump.fun-style initial virtual token reserves (1.073B tokens @ 6 decimals).
pub const DEFAULT_INITIAL_VIRTUAL_TOKEN_RESERVES: u64 = 1_073_000_000_000_000;
/// Fixed supply: 1,000,000,000 tokens @ 6 decimals.
pub const DEFAULT_TOTAL_TOKEN_SUPPLY: u64 = 1_000_000_000_000_000;
/// Tokens seeded onto the curve: 793,100,000 (79.31% of supply).
pub const DEFAULT_CURVE_TOKEN_RESERVES: u64 = 793_100_000_000_000;

/// Global singleton configuration, seeded at `[CONFIG_SEED]`.
#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub admin: Pubkey,
    /// Wallet receiving the protocol share of trading fees.
    pub fee_recipient: Pubkey,
    /// Total fee on every trade, in basis points (e.g. 100 = 1%).
    pub total_fee_bps: u16,
    /// Creator share of the fee, in basis points of the fee (e.g. 2000 = 20%).
    pub creator_fee_bps: u16,
    /// Real SOL reserves at which the curve graduates to the DEX.
    pub graduation_threshold_lamports: u64,
    /// Initial phantom SOL inserted into the virtual reserves.
    pub initial_virtual_sol_lamports: u64,
    /// Initial virtual token reserves (real curve tokens + phantom depth).
    pub initial_virtual_token_reserves: u64,
    /// Fixed total supply minted at launch (curve portion + phantom depth).
    pub total_token_supply: u64,
    /// Real token reserves seeded onto the curve at launch.
    pub curve_token_reserves: u64,
    /// Minimum SOL per buy (anti-dust spam guard).
    pub min_sol_for_buy: u64,
    pub bump: u8,
}

/// Per-token bonding curve, seeded at `[CURVE_SEED, mint]`.
#[account]
#[derive(InitSpace)]
pub struct BondingCurve {
    pub mint: Pubkey,
    pub creator: Pubkey,
    /// Token vault owned by the curve authority.
    pub curve_token_account: Pubkey,
    /// Virtual SOL reserves (real SOL + phantom depth) — the AMM x.
    pub virtual_sol_reserves: u64,
    /// Virtual token reserves — the AMM y.
    pub virtual_token_reserves: u64,
    /// Actual SOL held by the curve PDA (rent-exempt balance excluded).
    pub real_sol_reserves: u64,
    /// Actual tokens held in the curve vault.
    pub real_token_reserves: u64,
    pub token_total_supply: u64,
    /// True once the graduation threshold is reached (curve closed).
    pub complete: bool,
    pub created_at: i64,
    pub bump: u8,
}

/// Permanent liquidity custody created at migration, seeded at `[LOCK_SEED, mint]`.
///
/// Post-graduation the curve's SOL and remaining tokens are swept here and the
/// mint authority is burned — a burn-equivalent lock. The production migrator
/// then creates the Raydium AMM pool from this custody and burns 100% of the
/// LP tokens (see `raydium.rs`).
#[account]
#[derive(InitSpace)]
pub struct LockedLiquidity {
    pub mint: Pubkey,
    pub curve: Pubkey,
    pub sol_locked: u64,
    pub tokens_locked: u64,
    pub locked_at: i64,
    pub bump: u8,
}

#[event]
#[derive(Debug)]
pub struct CurveCreatedEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub timestamp: i64,
}

#[event]
#[derive(Debug)]
pub struct TradeEvent {
    pub mint: Pubkey,
    pub user: Pubkey,
    pub is_buy: bool,
    /// Gross SOL leg (lamports) for buys; net SOL received for sells.
    pub sol_amount: u64,
    pub token_amount: u64,
    pub protocol_fee: u64,
    pub creator_fee: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub timestamp: i64,
}

#[event]
#[derive(Debug)]
pub struct GraduationEvent {
    pub mint: Pubkey,
    pub sol_raised: u64,
    pub timestamp: i64,
}

#[event]
#[derive(Debug)]
pub struct MigrationEvent {
    pub mint: Pubkey,
    pub sol_locked: u64,
    pub tokens_locked: u64,
    pub timestamp: i64,
}
