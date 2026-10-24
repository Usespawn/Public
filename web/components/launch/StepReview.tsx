"use client";

/** Step 5: review & approval with full transaction summary. */
import { AlertTriangle } from "lucide-react";
import { getNetwork } from "@/lib/config";

export function StepReview({
  name,
  symbol,
  mint58,
  wallet58,
  onBack,
  onApprove,
}: {
  name: string;
  symbol: string;
  mint58: string;
  wallet58: string | null;
  onBack: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="glass rounded-2xl p-6 space-y-3">
      <h2 className="font-display text-lg font-bold">05 · Review &amp; approve</h2>
      <div className="space-y-2 font-mono text-[13px] text-muted">
        <div className="flex justify-between"><span className="text-faint">Token</span><span className="text-ink">{name} ({symbol})</span></div>
        <div className="flex justify-between items-center gap-2"><span className="text-faint shrink-0">Mint</span><span className="break-all text-acid">{mint58}</span></div>
        <div className="flex justify-between"><span className="text-faint">Network</span><span className="text-ink">Solana {getNetwork()}</span></div>
        <div className="flex justify-between"><span className="text-faint">Signatures</span><span className="text-ink">your wallet{wallet58 ? ` (${wallet58.slice(0, 4)}…${wallet58.slice(-4)})` : ""} + mint keypair</span></div>
      </div>
      <p className="flex items-start gap-2 text-[12px] text-warn">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        Launching is irreversible: the mint and bonding curve are created permanently on-chain; your
        wallet pays fees and rent.
      </p>
      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink transition-colors hover:bg-raised/60">Back</button>
        <button onClick={onApprove} className="rounded-full bg-acid px-6 py-2.5 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]">
          Approve &amp; launch →
        </button>
      </div>
    </div>
  );
}
