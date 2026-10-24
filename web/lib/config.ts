/**
 * SpawnPad network configuration.
 *
 * Development defaults to devnet — the official Pump.fun program
 * (6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P) is deployed on both mainnet
 * and devnet. Mainnet requires an explicit, deliberate configuration change.
 */
import { clusterApiUrl, PublicKey } from "@solana/web3.js";

export type SpawnNetwork = "devnet" | "mainnet-beta" | "localnet";

export const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export function getNetwork(): SpawnNetwork {
  const raw = (process.env.NEXT_PUBLIC_NETWORK || "devnet").trim();
  if (raw === "mainnet" || raw === "mainnet-beta") return "mainnet-beta";
  if (raw === "localnet") return "localnet";
  return "devnet";
}

export function getRpcUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (explicit) return explicit;
  const network = getNetwork();
  if (network === "localnet") return "http://127.0.0.1:8899";
  return clusterApiUrl(network === "mainnet-beta" ? "mainnet-beta" : "devnet");
}

/** Bonding curve PDA of a mint, per the official pump program derivation. */
export function bondingCurveAddress(mint: string): string {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), new PublicKey(mint).toBytes()],
    PUMP_PROGRAM_ID
  )[0].toBase58();
}

/** Mint-authority PDA used by the pump program for Token-2022 mints. */
export function mintAuthorityAddress(): string {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority")],
    PUMP_PROGRAM_ID
  )[0].toBase58();
}

export const MANDATORY_SUFFIX = "Spw";

/**
 * Official Spawn token contract address (CA) shown in the top navigation.
 *
 * Placeholder rules:
 *  - The value "TBA" (case-insensitive) renders as a non-copyable placeholder
 *    ("Official CA coming soon") and is NEVER written to the clipboard.
 *  - Replace this single value with the real mint address once published;
 *    the nav chip then shows the truncated address, its full value in the
 *    tooltip, and copies the COMPLETE address on click.
 *  - Never use the SpawnPad program ID, the pump.fun program ID, or any
 *    unrelated token address as a stand-in.
 */
export const SPAWN_OFFICIAL_TOKEN_CA = "TBA";

/** Exact case-sensitive Base58 suffix check against the full address.
 *
 *  Base58 rendering of a 32-byte pubkey is 43 or 44 characters (43 when the
 *  leading byte(s) are zero), so both lengths are accepted. */
export function isSpawnVanityAddress(address: string): boolean {
  return (
    typeof address === "string" &&
    (address.length === 44 || address.length === 43) &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(address) &&
    address.endsWith(MANDATORY_SUFFIX)
  );
}
