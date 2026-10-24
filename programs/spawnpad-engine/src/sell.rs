//! Sell tokens back into the bonding curve for SOL.

use crate::curve_math::{self, CurveReserves};
use crate::errors::SpawnError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [CURVE_SEED, mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    /// CHECK: curve authority PDA — owns the curve token vault.
    #[account(seeds = [CURVE_AUTHORITY_SEED, mint.key().as_ref()], bump)]
    pub curve_authority: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, address = bonding_curve.curve_token_account)]
    pub curve_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    /// CHECK: protocol fee recipient (from global config).
    #[account(mut, address = global_config.fee_recipient)]
    pub fee_recipient: SystemAccount<'info>,
    /// CHECK: token creator — receives the creator fee share.
    #[account(mut, address = bonding_curve.creator)]
    pub creator: SystemAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Sell>, token_amount_in: u64, min_sol_out: u64) -> Result<()> {
    let config = &ctx.accounts.global_config;
    let curve = &mut ctx.accounts.bonding_curve;
    require!(!curve.complete, SpawnError::CurveCompleted);
    require!(token_amount_in > 0, SpawnError::TokenAmountTooSmall);

    let mut reserves = CurveReserves {
        virtual_sol_reserves: curve.virtual_sol_reserves,
        virtual_token_reserves: curve.virtual_token_reserves,
        real_sol_reserves: curve.real_sol_reserves,
        real_token_reserves: curve.real_token_reserves,
    };
    let quote = curve_math::quote_sell(
        &reserves,
        token_amount_in,
        config.total_fee_bps,
        config.creator_fee_bps,
    )?;
    require!(quote.sol_out_net >= min_sol_out, SpawnError::SlippageExceeded);
    curve_math::apply_sell(&mut reserves, &quote)?;

    curve.virtual_sol_reserves = reserves.virtual_sol_reserves;
    curve.virtual_token_reserves = reserves.virtual_token_reserves;
    curve.real_sol_reserves = reserves.real_sol_reserves;
    curve.real_token_reserves = reserves.real_token_reserves;

    let mint_key = ctx.accounts.mint.key();

    // Token leg: seller → vault (seller signs their own transfer).
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.curve_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        token_amount_in,
    )?;

    // SOL leg 1: curve PDA → seller (net of fees), via lamports arithmetic
    // (the curve PDA is a program-owned data account — no system transfer).
    crate::distribute_lamports(
        &curve.to_account_info(),
        &ctx.accounts.seller.to_account_info(),
        quote.sol_out_net,
    )?;

    // SOL leg 2: fees leave the curve — protocol share then creator share.
    if quote.fees.protocol_fee > 0 {
        crate::distribute_lamports(
            &curve.to_account_info(),
            &ctx.accounts.fee_recipient.to_account_info(),
            quote.fees.protocol_fee,
        )?;
    }
    if quote.fees.creator_fee > 0 {
        crate::distribute_lamports(
            &curve.to_account_info(),
            &ctx.accounts.creator.to_account_info(),
            quote.fees.creator_fee,
        )?;
    }

    emit!(TradeEvent {
        mint: mint_key,
        user: ctx.accounts.seller.key(),
        is_buy: false,
        sol_amount: quote.sol_out_net,
        token_amount: token_amount_in,
        protocol_fee: quote.fees.protocol_fee,
        creator_fee: quote.fees.creator_fee,
        virtual_sol_reserves: curve.virtual_sol_reserves,
        virtual_token_reserves: curve.virtual_token_reserves,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
