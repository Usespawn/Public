//! DEX migration blueprint — Raydium AMM v4 (Solana mainnet).
//!
//! # Two-phase migration design
//!
//! **Phase 1 (this program, fully implemented):** when a curve graduates, the
//! `migrate` instruction sweeps the curve's SOL and remaining tokens into the
//! permanent on-chain `LockedLiquidity` PDA custody and burns the mint
//! authority. Supply becomes fixed and no further curve trading is possible —
//! a burn-equivalent custody for the migration liquidity.
//!
//! **Phase 2 (off-chain migrator service):** observes `MigrationEvent`s and
//! atomically:
//!   1. Creates a Raydium AMM v4 pool funded by the `LockedLiquidity` custody
//!      (SOL side wrapped to WSOL).
//!   2. Mints 100% of the LP tokens to the custody PDA.
//!   3. Burns all LP tokens (`burn` on the LP mint) — liquidity is permanently
//!      locked, exactly like pump.fun's LP burn.
//!   4. Emits a `LpBurned` index event consumed by the indexer to flip the
//!      token from "Graduated" to "Live on DEX" in the explore feed.
//!
//! # Raydium AMM v4 account layout (initialize2)
//!
//! | # | Account                   | Writable | Notes                          |
//! |---|---------------------------|----------|--------------------------------|
//! | 0 | amm_id                    | mut      | pool keypair, unique per mint  |
//! | 1 | amm_authority             | ro       | Raydium authority PDA          |
//! | 2 | amm_open_orders           | mut      | open-orders keypair            |
//! | 3 | amm_target                | ro       | unused (Zero)                  |
//! | 4 | lp_mint                   | mut      | LP token mint                  |
//! | 5 | base_mint                 | ro       | the Spw token mint             |
//! | 6 | quote_mint                | ro       | WSOL (`So11...1112`)           |
//! | 7 | lp_mint_authority         | ro       | amm authority                  |
//! | 8 | base_vault                | mut      | base token vault               |
//! | 9 | quote_vault               | mut      | WSOL vault                     |
//! | 10| serum_market              | ro       | OpenBook market (pre-created)  |
//! | 11| user_provide_base         | mut      | locked token account (source)  |
//! | 12| user_provide_quote        | mut      | lock PDA WSOL account (source) |
//! | 13| user_token_lp             | mut      | LP recipient (lock PDA)        |
//! | 14| user_owner                | ro       | lock PDA (signer)              |
//! | 15..| serum market accounts   | mut/ro   | bids/asks/event queue/vaults   |
//! | ..| token_program, rent, market_program, amm_program            |
//!
//! The OpenBook market must be created first (list instruction); pump.fun V2
//! instead targets **Pump AMM / Raydium CPMM** which skips OpenBook entirely —
//! the off-chain migrator defaults to the CPMM `createPool` CPI with:
//! pool_state, creator, authority, pool_token_vault, wsol_vault and the two
//! mints — a much simpler layout.

use anchor_lang::prelude::*;

/// Raydium AMM v4 program.
pub const RAYDIUM_AMM_V4_PROGRAM_ID: Pubkey =
    pubkey!("675kPJ9sitQVh2EYoP2aiY9jLFgjz4Y7pZHCFBwsLqmV");

/// Raydium CPMM (Pump AMM-compatible) program — recommended migration target.
pub const RAYDIUM_CPMM_PROGRAM_ID: Pubkey =
    pubkey!("CPMMoo8LZH9s3fUi7AgUWxVpbqpusxCCDLpRFwMckmYc");

/// Wrapped SOL mint — the quote side of every graduated pool.
pub const WSOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

/// OpenBook (Serum DEX v3) program — only needed for the legacy AMM v4 path.
pub const OPENBOOK_V3_PROGRAM_ID: Pubkey =
    pubkey!("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
