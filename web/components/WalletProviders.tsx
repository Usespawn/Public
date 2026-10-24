"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
} from "@solana/wallet-adapter-phantom";
import {
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-solflare";
import { getRpcUrl } from "@/lib/config";
import "@solana/wallet-adapter-react-ui/styles.css";

// Single source of truth for the RPC endpoint (lib/config): the wallet's
// ConnectionProvider and the launch/verify flows must always talk to the SAME
// network. Previously this defaulted to http://127.0.0.1:8899 (localnet) while
// the launch flow used getRpcUrl() -> devnet, an inconsistent pair when no
// NEXT_PUBLIC_SOLANA_RPC is set.
export function WalletProviders({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getRpcUrl(), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
