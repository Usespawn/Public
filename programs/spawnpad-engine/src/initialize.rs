//! Global config bootstrap + admin updates.

use crate::errors::SpawnError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InitConfigParams {
    /// Wallet receiving the protocol share of trading fees.
    pub fee_recipient: Pubkey,
    /// Total fee on every trade, in basis points (e.g. 100 = 1%).
    pub total_fee_bps: u16,
    /// Creator share of the fee, in basis points of the fee (e.g. 2000 = 20%).
    pub creator_fee_bps: u16,
    /// Real SOL reserves at which the curve graduates ($10k–$60k band).
    pub graduation_threshold_lamports: u64,
    pub initial_virtual_sol_lamports: u64,
    pub initial_virtual_token_reserves: u64,
    pub total_token_supply: u64,
    pub curve_token_reserves: u64,
    /// Minimum SOL per buy (anti-dust spam guard).
    pub min_sol_for_buy: u64,
}

impl InitConfigParams {
    /// Pump.fun-style production defaults.
    pub fn production_defaults() -> Self {
        Self {
            fee_recipient: Pubkey::default(),
            total_fee_bps: DEFAULT_TOTAL_FEE_BPS,
            creator_fee_bps: DEFAULT_CREATOR_FEE_BPS,
            graduation_threshold_lamports: DEFAULT_GRADUATION_THRESHOLD_LAMPORTS,
            initial_virtual_sol_lamports: DEFAULT_INITIAL_VIRTUAL_SOL_LAMPORTS,
            initial_virtual_token_reserves: DEFAULT_INITIAL_VIRTUAL_TOKEN_RESERVES,
            total_token_supply: DEFAULT_TOTAL_TOKEN_SUPPLY,
            curve_token_reserves: DEFAULT_CURVE_TOKEN_RESERVES,
            min_sol_for_buy: 1_000_000, // 0.001 SOL
        }
    }

    pub fn validate(&self) -> Result<()> {
        require!(self.total_fee_bps <= 1_000, SpawnError::InvalidFeeConfig);
        require!(self.creator_fee_bps <= 10_000, SpawnError::InvalidFeeConfig);
        require!(
            self.graduation_threshold_lamports >= 100_000_000,
            SpawnError::InvalidGraduationThreshold
        );
        require!(self.initial_virtual_sol_lamports > 0, SpawnError::InvalidCurveParams);
        require!(
            self.curve_token_reserves > 0 && self.curve_token_reserves <= self.total_token_supply,
            SpawnError::InvalidCurveParams
        );
        require!(
            self.initial_virtual_token_reserves >= self.curve_token_reserves,
            SpawnError::InvalidCurveParams
        );
        require!(self.min_sol_for_buy > 0, SpawnError::InvalidCurveParams);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, params: InitConfigParams) -> Result<()> {
    params.validate()?;

    let config = &mut ctx.accounts.global_config;
    config.admin = ctx.accounts.admin.key();
    config.fee_recipient = params.fee_recipient;
    config.total_fee_bps = params.total_fee_bps;
    config.creator_fee_bps = params.creator_fee_bps;
    config.graduation_threshold_lamports = params.graduation_threshold_lamports;
    config.initial_virtual_sol_lamports = params.initial_virtual_sol_lamports;
    config.initial_virtual_token_reserves = params.initial_virtual_token_reserves;
    config.total_token_supply = params.total_token_supply;
    config.curve_token_reserves = params.curve_token_reserves;
    config.min_sol_for_buy = params.min_sol_for_buy;
    config.bump = ctx.bumps.global_config;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        constraint = admin.key() == global_config.admin @ SpawnError::Unauthorized,
    )]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = global_config.bump,
        constraint = global_config.admin != Pubkey::default() @ SpawnError::ConfigAlreadyInitialized,
    )]
    pub global_config: Account<'info, GlobalConfig>,
}

pub fn update_handler(ctx: Context<UpdateConfig>, params: InitConfigParams) -> Result<()> {
    params.validate()?;

    let config = &mut ctx.accounts.global_config;
    config.fee_recipient = params.fee_recipient;
    config.total_fee_bps = params.total_fee_bps;
    config.creator_fee_bps = params.creator_fee_bps;
    config.graduation_threshold_lamports = params.graduation_threshold_lamports;
    config.initial_virtual_sol_lamports = params.initial_virtual_sol_lamports;
    config.initial_virtual_token_reserves = params.initial_virtual_token_reserves;
    config.total_token_supply = params.total_token_supply;
    config.curve_token_reserves = params.curve_token_reserves;
    config.min_sol_for_buy = params.min_sol_for_buy;
    Ok(())
}
