"use client";

/** Step 6 (execute) + Step 7 (verified success). */
import { Loader2, ExternalLink } from "lucide-react";
import { StatePill, ErrorLine } from "./ui";
import { VanityState } from "@/lib/vanity/state-machine";
import { getNetwork } from "@/lib/config";

export function StepExecute({
  state,
  submitting,
  signature,
  error,
  onSubmit,
  onBack,
}: {
  state: VanityState;
  submitting: boolean;
  signature: string | null;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="surface relative overflow-hidden rounded-xl p-6 shadow-panel space-y-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid/60 to-transparent" />
      <h2 className="font-display text-lg font-bold">06 · Execute</h2>
      <StatePill state={state} />
      {submitting ? (
        <div className="flex items-center gap-2 text-acid"><Loader2 className="size-4 animate-spin" /> building &amp; signing…</div>
      ) : (
        <button onClick={onSubmit} className="rounded-full bg-acid px-6 py-2.5 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]">
          Sign &amp; submit transaction
        </button>
      )}
      {signature && <div className="font-mono text-[12px] break-all text-muted">tx: {signature}</div>}
      {error && <ErrorLine text={error} />}
      <button onClick={onBack} disabled={submitting} className="block text-[13px] text-faint transition-colors hover:text-ink disabled:opacity-40">← back to review</button>
    </div>
  );
}

export function StepSuccess({
  name,
  symbol,
  mint58,
  signature,
  backendStatus,
  onReset,
}: {
  name: string;
  symbol: string;
  mint58: string;
  signature: string | null;
  backendStatus: string | null;
  onReset: () => void;
}) {
  const cluster = getNetwork() === "mainnet-beta" ? "" : "?cluster=devnet";
  return (
    <div className="surface rounded-2xl border border-ok/40 p-6 shadow-panel space-y-4">
      <h2 className="font-display text-lg font-bold text-ok">07 · Launch verified on-chain</h2>
      <div className="space-y-1 font-mono text-[13px]">
        <div className="text-ink">{name} ({symbol})</div>
        <div className="break-all text-acid">{mint58}</div>
        {signature && <div className="break-all text-muted">tx: {signature}</div>}
        <div className="text-faint">verified at {new Date().toISOString()}</div>
        {backendStatus && <div className="text-muted">{backendStatus}</div>}
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={`https://solscan.io/token/${mint58}${cluster}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-acid px-4 py-2 font-mono text-[12.5px] font-bold text-obsidian transition-colors hover:bg-[#7DF0FF]">
          Solscan <ExternalLink className="size-3.5" />
        </a>
        <a href={`https://pump.fun/${mint58}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink transition-colors hover:bg-raised/60">
          pump.fun page <ExternalLink className="size-3.5" />
        </a>
        <button onClick={() => navigator.clipboard.writeText(mint58)} className="rounded-full border border-line-strong px-4 py-2 text-[13px] text-muted transition-colors hover:bg-raised/60 hover:text-ink">Copy address</button>
        <button onClick={onReset} className="rounded-full border border-line-strong px-4 py-2 text-[13px] text-muted transition-colors hover:bg-raised/60 hover:text-ink">Launch another</button>
      </div>
    </div>
  );
}
