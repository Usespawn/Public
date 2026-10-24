"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { TokenFeed } from "@/components/TokenFeed";
import { shortAddr } from "@/lib/utils";
import { Connection } from "@solana/web3.js";
import { getRpcUrl } from "@/lib/config";

export default function PortfolioPage() {
  const { publicKey, connected } = useWallet();
  const [sol, setSol] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    const c = new Connection(getRpcUrl(), "confirmed");
    c.getBalance(publicKey).then((b) => setSol(b / 1e9));
  }, [publicKey]);

  if (!connected || !publicKey) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p className="text-sm text-muted">Connect your wallet to see your portfolio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <h1 className="font-display text-xl font-bold">Portfolio</h1>
        <div className="mt-3 flex flex-wrap gap-6 font-mono text-[13px]">
          <div><div className="text-faint text-[11px] uppercase">Wallet</div><div>{shortAddr(publicKey.toBase58(), 6, 6)}</div></div>
          <div><div className="text-faint text-[11px] uppercase">SOL balance</div><div className="text-acid">{sol === null ? "…" : sol.toFixed(4)}</div></div>
        </div>
      </div>
      <TokenFeed title="Your verified launches" />
    </div>
  );
}
