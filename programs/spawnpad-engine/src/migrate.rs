//! Migration of a graduated curve: sweep all curve liquidity into the permanent
//! `LockedLiquidity` custody and burn the mint authority (LP-burn equivalent;
//! see `raydium.rs` for the production Raydium pool-creation phase).

use crate::errors::SpawnError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::{self, AssociatedToken};
use anchor_spl::token::{self, Mint, SetAuthority, Token, TokenAccount};
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_lang::{AnchorSerialize, Discriminator};

#[derive(Accounts)]
pub struct Migrate<'info> {
    /// Anyone may trigger migration — permissionless.
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [CURVE_SEED, mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
        constraint = bonding_curve.complete @ SpawnError::NotGraduated,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    /// CHECK: curve authority PDA — current mint & vault authority.
    #[account(seeds = [CURVE_AUTHORITY_SEED, mint.key().as_ref()], bump)]
    pub curve_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut, address = bonding_curve.curve_token_account)]
    pub curve_token_account: Account<'info, TokenAccount>,
    /// CHECK: locked liquidity custody PDA — created & written manually in the
    /// handler (Anchor 0.30 `Account<T>` + `init` + `to_account_info` on a
    /// freshly-created account crashes on SBF).
    #[account(mut, seeds = [LOCK_SEED, mint.key().as_ref()], bump)]
    pub locked_liquidity: UncheckedAccount<'info>,
    /// CHECK: locked token vault — ATA of the custody PDA, created via CPI.
    #[account(mut)]
    pub locked_token_account: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Migrate>) -> Result<()> {
    msg!("MIGRATE 0");
    let curve = &mut ctx.accounts.bonding_curve;
    let mint_key = ctx.accounts.mint.key();
    msg!("MIGRATE 0b");

    // 0) Create the locked-liquidity custody (PDA-owned program account),
    //    funded by the caller.
    let rent = anchor_lang::solana_program::sysvar::rent::Rent::get()?;
    let lock_space = 8 + LockedLiquidity::INIT_SPACE;
    let lock_lamports = rent.minimum_balance(lock_space);
    let lock_info = ctx.accounts.locked_liquidity.to_account_info();
    if lock_info.data_is_empty() {
        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::create_account(
                &ctx.accounts.caller.key(),
                &lock_info.key(),
                lock_lamports,
                lock_space as u64,
                ctx.program_id,
            ),
            &[
                ctx.accounts.caller.to_account_info(),
                lock_info.clone(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&[LOCK_SEED, mint_key.as_ref(), &[ctx.bumps.locked_liquidity]]],
        )?;
    }
    msg!("MIGRATE 0c");

    // 0b) Create the locked token vault (ATA owned by the custody PDA).
    if ctx.accounts.locked_token_account.data_is_empty() {
        associated_token::create_idempotent(CpiContext::new(
            ctx.accounts.associated_token_program.to_account_info(),
            associated_token::Create {
                payer: ctx.accounts.caller.to_account_info(),
                associated_token: ctx.accounts.locked_token_account.to_account_info(),
                authority: lock_info.clone(),
                mint: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
        ))?;
    }
    msg!("MIGRATE 0d");

    // 1) Sweep all SOL above the curve's rent-exempt minimum into the lock PDA.
    let curve_rent_min = rent.minimum_balance(8 + BondingCurve::INIT_SPACE);
    msg!("MIGRATE 1");
    let curve_lamports = curve.to_account_info().lamports();
    msg!("MIGRATE 2");
    require!(curve_lamports >= curve_rent_min, SpawnError::InsufficientLiquidity);
    let sol_locked = curve_lamports - curve_rent_min;

    // Lamports arithmetic — the curve PDA is a program-owned data account.
    // (inlined from crate::distribute_lamports with checkpoints)
    msg!("MIGRATE 2a");
    let from_info = curve.to_account_info();
    msg!("MIGRATE 2b");
    let to_info = ctx.accounts.locked_liquidity.to_account_info();
    msg!("MIGRATE 2c");
    {
        let mut from_l = from_info.lamports.borrow_mut();
        msg!("MIGRATE 2d");
        let mut to_l = to_info.lamports.borrow_mut();
        msg!("MIGRATE 2e");
        let new_from = from_l
            .checked_sub(sol_locked)
            .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
        let new_to = to_l
            .checked_add(sol_locked)
            .ok_or_else(|| error!(SpawnError::CurveOverflow))?;
        **from_l = new_from;
        **to_l = new_to;
    }
    msg!("MIGRATE 3");

    let tokens_locked = anchor_spl::token::accessor::amount(
        &ctx.accounts.curve_token_account.to_account_info(),
    )?;
    msg!("MIGRATE 4");

    let authority_seeds: &[&[&[u8]]] =
        &[&[CURVE_AUTHORITY_SEED, mint_key.as_ref(), &[ctx.bumps.curve_authority]]];

    // 2) Sweep the remaining curve tokens into the locked token account.
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.curve_token_account.to_account_info(),
                to: ctx.accounts.locked_token_account.to_account_info(),
                authority: ctx.accounts.curve_authority.to_account_info(),
            },
            authority_seeds,
        ),
        tokens_locked,
    )?;
    msg!("MIGRATE 5");

    // 3) Burn the mint & freeze authority — supply becomes permanently fixed.
    token::set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.curve_authority.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
            authority_seeds,
        ),
        AuthorityType::MintTokens,
        None,
    )?;
    msg!("MIGRATE 6");
    token::set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.curve_authority.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
            authority_seeds,
        ),
        AuthorityType::FreezeAccount,
        None,
    )?;
    msg!("MIGRATE 7");

    // 4) Zero the curve reserves and record the locked liquidity.
    curve.real_sol_reserves = 0;
    curve.real_token_reserves = 0;

    // 5) Write the custody record (discriminator + borsh fields).
    let locked_at = Clock::get()?.unix_timestamp;
    let record = LockedLiquidity {
        mint: mint_key,
        curve: ctx.accounts.bonding_curve.key(),
        sol_locked,
        tokens_locked,
        locked_at,
        bump: ctx.bumps.locked_liquidity,
    };
    {
        let mut data = lock_info.try_borrow_mut_data()?;
        data[0..8].copy_from_slice(&LockedLiquidity::discriminator());
        AnchorSerialize::serialize(&record, &mut &mut data[8..])
            .map_err(|_| error!(SpawnError::CurveOverflow))?;
    }
    msg!("MIGRATE 8");

    emit!(MigrationEvent {
        mint: mint_key,
        sol_locked,
        tokens_locked,
        timestamp: locked_at,
    });
    Ok(())
}
