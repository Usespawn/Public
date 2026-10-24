//! Launch ("morph") a new Spawnpad token: vanity `Spw` mint + bonding curve init.

use crate::errors::SpawnError;
use crate::state::*;
use crate::vanity;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::associated_token::{self, AssociatedToken};
use anchor_spl::metadata::mpl_token_metadata::types::{Creator, DataV2};
use anchor_spl::metadata::{create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata};
use anchor_spl::token::{self, Token};

pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize = 256;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateCurveParams {
    pub name: String,
    pub symbol: String,
    /// IPFS metadata URI (uploaded via Pinata/NFT.Storage by the frontend).
    pub uri: String,
}

#[derive(Accounts)]
pub struct CreateCurve<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The off-chain-ground vanity mint keypair — must sign the launch tx.
    #[account(
        mut,
        constraint = mint.to_account_info().data_is_empty()
            && mint.lamports() == 0 @ SpawnError::MintAccountNotEmpty,
        constraint = vanity::is_spawn_vanity(&mint.key()) @ SpawnError::NotSpawnVanity,
    )]
    pub mint: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(
        init,
        payer = payer,
        space = 8 + BondingCurve::INIT_SPACE,
        seeds = [CURVE_SEED, mint.key().as_ref()],
        bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    /// CHECK: curve authority PDA — owns the token vault and signs curve CPIs.
    #[account(seeds = [CURVE_AUTHORITY_SEED, mint.key().as_ref()], bump)]
    pub curve_authority: UncheckedAccount<'info>,
    /// CHECK: ATA vault owned by the curve authority — created via CPI inside
    /// the handler (after the mint exists), so it must NOT be `init` here.
    #[account(mut)]
    pub curve_token_account: UncheckedAccount<'info>,
    /// CHECK: Metaplex metadata PDA for the vanity mint.
    #[account(
        mut,
        seeds = [b"metadata", anchor_spl::metadata::ID.as_ref(), mint.key().as_ref()],
        bump,
        seeds::program = anchor_spl::metadata::ID,
    )]
    pub metadata: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateCurve>, params: CreateCurveParams) -> Result<()> {
    require!(
        !params.name.is_empty() && params.name.len() <= MAX_NAME_LEN,
        SpawnError::InvalidTokenParams
    );
    require!(
        !params.symbol.is_empty() && params.symbol.len() <= MAX_SYMBOL_LEN,
        SpawnError::InvalidTokenParams
    );
    require!(params.uri.len() <= MAX_URI_LEN, SpawnError::InvalidTokenParams);

    let config = &ctx.accounts.global_config;
    let mint_key = ctx.accounts.mint.key();
    let authority_bump = ctx.bumps.curve_authority;
    let authority_seeds: &[&[&[u8]]] =
        &[&[CURVE_AUTHORITY_SEED, mint_key.as_ref(), &[authority_bump]]];

    // 1) Create the mint account. The vanity keypair's signature is inherited
    //    from the parent instruction by `invoke`.
    let rent_lamports = ctx.accounts.rent.minimum_balance(MINT_SPACE);
    invoke(
        &system_instruction::create_account(
            &ctx.accounts.payer.key(),
            &mint_key,
            rent_lamports,
            MINT_SPACE as u64,
            &ctx.accounts.token_program.key(),
        ),
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
    )?;

    // 2) Initialize the mint — curve authority is the (temporary) mint authority.
    token::initialize_mint2(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::InitializeMint2 {
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        TOKEN_DECIMALS,
        &ctx.accounts.curve_authority.key(),
        Some(&ctx.accounts.curve_authority.key()),
    )?;

    // 2b) Create the curve's ATA vault via idempotent CPI (the mint now exists).
    associated_token::create_idempotent(
        CpiContext::new(
            ctx.accounts.associated_token_program.to_account_info(),
            associated_token::Create {
                payer: ctx.accounts.payer.to_account_info(),
                associated_token: ctx.accounts.curve_token_account.to_account_info(),
                authority: ctx.accounts.curve_authority.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
        ),
    )?;

    // 3) Metaplex metadata (immutable, creator = launcher).
    let creators = Some(vec![Creator {
        address: ctx.accounts.payer.key(),
        verified: false,
        share: 100,
    }]);
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.curve_authority.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.curve_authority.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            authority_seeds,
        ),
        DataV2 {
            name: params.name.clone(),
            symbol: params.symbol.clone(),
            uri: params.uri.clone(),
            seller_fee_basis_points: 0,
            creators,
            collection: None,
            uses: None,
        },
        false, // is_mutable — metadata is immutable, like pump.fun
        false, // update_authority_is_signer
        None,  // collection_details
    )?;

    // 4) Mint the curve token supply into the vault.
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.curve_token_account.to_account_info(),
                authority: ctx.accounts.curve_authority.to_account_info(),
            },
            authority_seeds,
        ),
        config.curve_token_reserves,
    )?;

    // 5) Initialize bonding curve state (pump.fun-style virtual reserves).
    let curve = &mut ctx.accounts.bonding_curve;
    curve.mint = mint_key;
    curve.creator = ctx.accounts.payer.key();
    curve.curve_token_account = ctx.accounts.curve_token_account.key();
    curve.virtual_sol_reserves = config.initial_virtual_sol_lamports;
    curve.virtual_token_reserves = config.initial_virtual_token_reserves;
    curve.real_sol_reserves = 0;
    curve.real_token_reserves = config.curve_token_reserves;
    curve.token_total_supply = config.total_token_supply;
    curve.complete = false;
    curve.created_at = Clock::get()?.unix_timestamp;
    curve.bump = ctx.bumps.bonding_curve;

    emit!(CurveCreatedEvent {
        mint: mint_key,
        creator: ctx.accounts.payer.key(),
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        timestamp: curve.created_at,
    });
    Ok(())
}
