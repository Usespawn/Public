//! Spawnpad engine error codes.

use anchor_lang::prelude::*;

#[error_code]
pub enum SpawnError {
    #[msg("Unauthorized — caller is not the config admin")]
    Unauthorized,
    #[msg("Global config already initialized")]
    ConfigAlreadyInitialized,
    #[msg("Invalid fee configuration — total fee must be <= 1000 bps and creator share <= 10000 bps")]
    InvalidFeeConfig,
    #[msg("Invalid graduation threshold — must be at least 0.1 SOL")]
    InvalidGraduationThreshold,
    #[msg("Invalid curve parameters")]
    InvalidCurveParams,
    #[msg("Mint address does not end with the Spw vanity suffix")]
    NotSpawnVanity,
    #[msg("Mint keypair must sign the create_curve transaction")]
    MintMustSign,
    #[msg("Mint account already exists or is not fresh")]
    MintAccountNotEmpty,
    #[msg("Invalid token launch parameters (name/symbol/uri)")]
    InvalidTokenParams,
    #[msg("Curve is complete — trading has migrated to the DEX")]
    CurveCompleted,
    #[msg("Curve already graduated")]
    CurveAlreadyGraduated,
    #[msg("Curve has not reached the graduation threshold")]
    NotGraduated,
    #[msg("Buy amount below the configured minimum")]
    BuyTooSmall,
    #[msg("Token amount too small")]
    TokenAmountTooSmall,
    #[msg("Sell produces zero SOL output")]
    SellTooSmall,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Insufficient liquidity on the curve")]
    InsufficientLiquidity,
    #[msg("Curve math overflow")]
    CurveOverflow,
}
