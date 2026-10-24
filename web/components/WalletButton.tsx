"use client";

/**
 * Mount-gated wallet button.
 *
 * ROOT CAUSE (hydration): @solana/wallet-adapter-react-ui's internal `Button`
 * renders <i className="wallet-adapter-button-start-icon"> conditionally on
 * browser-only wallet detection (window.solana readyState, localStorage
 * auto-connect). Server HTML therefore lacks the <i> that the first client
 * render produces -> "Expected server HTML to contain a matching <i> in
 * <button>". The wallet button is genuinely browser-dependent, so we render
 * a stable, visually identical placeholder until after mount.
 */
import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Deterministic server + first-client-render markup. Visually matches the
    // themed .wallet-adapter-button (see globals.css) so there is no layout shift.
    return (
      <button
        type="button"
        className="wallet-adapter-button wallet-adapter-button-trigger"
        aria-label="Connect wallet"
        tabIndex={-1}
      >
        Select Wallet
      </button>
    );
  }

  return <WalletMultiButton />;
}
