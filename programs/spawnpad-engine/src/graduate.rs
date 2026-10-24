//! Permissionless graduation trigger (usually fired automatically by the
//! `buy` instruction once the SOL threshold is crossed).

use crate::errors::SpawnError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

#[derive(Accounts)]
pub struct Graduate<'info> {
    /// Anyone may trigger graduation — it is permissionless and idempotent-safe.
    pub caller: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [CURVE_SEED, mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    pub mint: Account<'info, Mint>,
}

pub fn handler(ctx: Context<Graduate>) -> Result<()> {
    let config = &ctx.accounts.global_config;
    let curve = &mut ctx.accounts.bonding_curve;

    require!(!curve.complete, SpawnError::CurveAlreadyGraduated);
    require!(
        curve.real_sol_reserves >= config.graduation_threshold_lamports,
        SpawnError::NotGraduated
    );

    curve.complete = true;
    emit!(GraduationEvent {
        mint: ctx.accounts.mint.key(),
        sol_raised: curve.real_sol_reserves,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
