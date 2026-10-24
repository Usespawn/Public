//! Buy tokens from an active bonding curve with SOL.

use crate::curve_math::{self, CurveReserves};
use crate::errors::SpawnError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [CURVE_SEED, mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    /// CHECK: curve authority PDA — signs vault token transfers.
    #[account(seeds = [CURVE_AUTHORITY_SEED, mint.key().as_ref()], bump)]
    pub curve_authority: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, address = bonding_curve.curve_token_account)]
    pub curve_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    /// CHECK: protocol fee recipient (from global config).
    #[account(mut, address = global_config.fee_recipient)]
    pub fee_recipient: SystemAccount<'info>,
    /// CHECK: token creator — receives the creator fee share.
    #[account(mut, address = bonding_curve.creator)]
    pub creator: SystemAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Buy>, amount_lamports: u64, min_token_out: u64) -> Result<()> {
    let config = &ctx.accounts.global_config;
    require!(amount_lamports >= config.min_sol_for_buy, SpawnError::BuyTooSmall);

    let curve_key = ctx.accounts.bonding_curve.key();
    let curve = &mut ctx.accounts.bonding_curve;
    require!(!curve.complete, SpawnError::CurveCompleted);

    let mut reserves = CurveReserves {
        virtual_sol_reserves: curve.virtual_sol_reserves,
        virtual_token_reserves: curve.virtual_token_reserves,
        real_sol_reserves: curve.real_sol_reserves,
        real_token_reserves: curve.real_token_reserves,
    };
    let quote = curve_math::quote_buy(
        &reserves,
        amount_lamports,
        config.total_fee_bps,
        config.creator_fee_bps,
    )?;
    require!(quote.tokens_out >= min_token_out, SpawnError::SlippageExceeded);
    curve_math::apply_buy(&mut reserves, &quote)?;

    curve.virtual_sol_reserves = reserves.virtual_sol_reserves;
    curve.virtual_token_reserves = reserves.virtual_token_reserves;
    curve.real_sol_reserves = reserves.real_sol_reserves;
    curve.real_token_reserves = reserves.real_token_reserves;

    let mint_key = ctx.accounts.mint.key();

    // SOL leg 1: buyer → curve PDA vault (gross amount).
    invoke(
        &system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &curve_key,
            amount_lamports,
        ),
        &[
            ctx.accounts.buyer.to_account_info(),
            curve.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // SOL leg 2: fees leave the curve — protocol share then creator share
    // (lamports arithmetic: the curve PDA is a program-owned data account).
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

    // Token leg: vault → buyer, signed by the curve authority PDA.
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.curve_token_account.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.curve_authority.to_account_info(),
            },
            &[&[CURVE_AUTHORITY_SEED, mint_key.as_ref(), &[ctx.bumps.curve_authority]]],
        ),
        quote.tokens_out,
    )?;

    // Auto-graduation check.
    let threshold = config.graduation_threshold_lamports;
    if !curve.complete && curve.real_sol_reserves >= threshold {
        curve.complete = true;
        emit!(GraduationEvent {
            mint: mint_key,
            sol_raised: curve.real_sol_reserves,
            timestamp: Clock::get()?.unix_timestamp,
        });
    }

    emit!(TradeEvent {
        mint: mint_key,
        user: ctx.accounts.buyer.key(),
        is_buy: true,
        sol_amount: amount_lamports,
        token_amount: quote.tokens_out,
        protocol_fee: quote.fees.protocol_fee,
        creator_fee: quote.fees.creator_fee,
        virtual_sol_reserves: curve.virtual_sol_reserves,
        virtual_token_reserves: curve.virtual_token_reserves,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
