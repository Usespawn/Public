//! Spawnpad engine (`spawn.fun`) — a Pump.fun V2-style bonding curve launchpad
//! where every launched token mint ends with the vanity suffix `Spw`.
//!
//! Core mechanics:
//! - Constant-product virtual reserve model (no initial LP capital needed).
//! - Buy/sell directly against the curve with protocol + creator fee splits.
//! - Automatic graduation when real SOL reserves hit the configured threshold.
//! - Migration: liquidity swept into a permanent on-chain lock (LP-burn
//!   equivalent) with the Raydium AMM CPI blueprint documented in `raydium`.

#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

use crate::errors::SpawnError;

pub mod buy;
pub mod curve_math;
pub mod create_curve;
pub mod errors;
pub mod graduate;
pub mod initialize;
pub mod migrate;
pub mod raydium;
pub mod sell;
pub mod state;
pub mod vanity;

// Re-export every instruction module's contents (Accounts structs, params and
// the Anchor-generated `__client_accounts_*` / `__cpi_client_accounts_*`
// modules) at the crate root. The `#[program]` macro's generated code uses
// `use super::*` plus `use crate::__client_accounts_*::*` paths.
pub(crate) use buy::*;
pub(crate) use create_curve::*;
pub(crate) use graduate::*;
pub(crate) use initialize::*;
pub(crate) use migrate::*;
pub(crate) use sell::*;

declare_id!("3CNhTgbuB68YC5C2vGTCJL6LpHvTokdsLQ1Xkv37s3mg");

/// Distributes lamports from a program-owned vault (data account) to a
/// recipient using direct lamports arithmetic — system transfers are not
/// allowed FROM program-owned data accounts ("from must not carry data").
/// Total lamports are conserved; both accounts are writable in every call site.
pub(crate) fn distribute_lamports<'info>(
    from: &anchor_lang::solana_program::account_info::AccountInfo<'info>,
    to: &anchor_lang::solana_program::account_info::AccountInfo<'info>,
    lamports: u64,
) -> Result<()> {
    let mut from_l = from.lamports.borrow_mut();
    let mut to_l = to.lamports.borrow_mut();
    let new_from = from_l
        .checked_sub(lamports)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    let new_to = to_l
        .checked_add(lamports)
        .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
    **from_l = new_from;
    **to_l = new_to;
    Ok(())
}

#[program]
pub mod spawnpad_engine {
    use super::*;

    /// Bootstrap the global launchpad configuration (admin only).
    pub fn initialize(ctx: Context<Initialize>, params: InitConfigParams) -> Result<()> {
        initialize::handler(ctx, params)
    }

    /// Admin update of the global configuration.
    pub fn update_config(ctx: Context<UpdateConfig>, params: InitConfigParams) -> Result<()> {
        initialize::update_handler(ctx, params)
    }

    /// Launch ("morph") a new token with a vanity `Spw` mint and start its curve.
    pub fn create_curve(ctx: Context<CreateCurve>, params: CreateCurveParams) -> Result<()> {
        create_curve::handler(ctx, params)
    }

    /// Buy tokens from the bonding curve with SOL.
    pub fn buy(ctx: Context<Buy>, amount_lamports: u64, min_token_out: u64) -> Result<()> {
        buy::handler(ctx, amount_lamports, min_token_out)
    }

    /// Sell tokens back into the bonding curve for SOL.
    pub fn sell(ctx: Context<Sell>, token_amount_in: u64, min_sol_out: u64) -> Result<()> {
        sell::handler(ctx, token_amount_in, min_sol_out)
    }

    /// Permissionlessly mark a curve as graduated once the SOL threshold is met.
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        graduate::handler(ctx)
    }

    /// Migrate a graduated curve: lock all curve liquidity and burn mint authority.
    pub fn migrate(ctx: Context<Migrate>) -> Result<()> {
        migrate::handler(ctx)
    }
}
