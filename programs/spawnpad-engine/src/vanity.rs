//! Vanity address enforcement: every mint launched via Spawnpad must end in
//! the `Spw` suffix (case-insensitive on-chain; the off-chain grinder targets
//! the exact brand casing `Spw`).
//!
//! Base58 is case-sensitive, so an exact `Spw` suffix has probability
//! `58^-3 ≈ 1/195,112` per keypair — grindable in about a second on a modern
//! CPU with worker threads (see `packages/vanity-grinder`).

use anchor_lang::prelude::Pubkey;

/// Case-insensitive suffix/prefix check on a rendered Base58 address.
pub fn ends_with_vanity(address_b58: &str, suffix: &str) -> bool {
    if suffix.is_empty() {
        return true;
    }
    if address_b58.len() < suffix.len() {
        return false;
    }
    let tail = &address_b58[address_b58.len() - suffix.len()..];
    tail.eq_ignore_ascii_case(suffix)
}

/// True if the pubkey's Base58 rendering ends with the Spawnpad vanity suffix.
pub fn is_spawn_vanity(pubkey: &Pubkey) -> bool {
    ends_with_vanity(&pubkey.to_string(), crate::state::VANITY_SUFFIX)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn suffix_match_is_case_insensitive() {
        assert!(ends_with_vanity("1B8xSpw", "Spw"));
        assert!(ends_with_vanity("1B8xspw", "Spw"));
        assert!(ends_with_vanity("1B8xSPW", "Spw"));
        assert!(ends_with_vanity("Spw", "Spw"));
        assert!(!ends_with_vanity("Sp", "Spw"));
        assert!(!ends_with_vanity("", "Spw"));
        assert!(!ends_with_vanity("1B8xApw", "Spw"));
        // Empty suffix matches everything.
        assert!(ends_with_vanity("anything", ""));
    }

    #[test]
    fn known_non_vanity_pubkeys_rejected() {
        let system = Pubkey::default(); // 1111...111
        assert!(!is_spawn_vanity(&system));
        let token_program = Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap();
        assert!(!is_spawn_vanity(&token_program));
    }

    /// A real ground vanity address (produced by packages/vanity-grinder).
    #[test]
    fn real_ground_vanity_address_accepted() {
        // Grinded during development: F1KyPXgyxjYayBTpNYCVUhwhaf99QNq2jrhdR1qCJSpw
        // (37,118 attempts @ 5,401/s on the 8-worker pool).
        let vanity = Pubkey::from_str("F1KyPXgyxjYayBTpNYCVUhwhaf99QNq2jrhdR1qCJSpw").unwrap();
        assert!(is_spawn_vanity(&vanity));
    }
}
