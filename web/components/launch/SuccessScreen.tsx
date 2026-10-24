"use client";

/**
 * Verified success screen (Phase 8). Everything shown comes from confirmed
 * on-chain data — estimates are never displayed as actuals.
 */
import { BadgeCheck, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { MANDATORY_SUFFIX, isSpawnVanityAddress } from "@/lib/config";

export interface DevBuyResultView {
  enabled: boolean;
  /** Actual SOL that left the wallet (buy + fees + rent), verified on-chain. */
  solSpentSol: string | null;
  /** Actual tokens received, verified on-chain. */
  tokensReceived: string | null;
}

export function SuccessScreen({
  name,
  symbol,
  mint58,
  creator58,
  signature,
  devBuy,
  clusterQuery,
  onReset,
}: {
  name: string;
  symbol: string;
  mint58: string;
  creator58: string | null;
  signature: string | null;
  devBuy: DevBuyResultView;
  clusterQuery: string;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const suffixOk = isSpawnVanityAddress(mint58);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(mint58);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="surface rounded-2xl border border-ok/40 p-6 shadow-panel space-y-4">
      <div className="flex items-center gap-2">
        <BadgeCheck className="size-5 text-ok" />
        <h2 className="font-display text-lg font-bold text-ok">Token launched successfully!</h2>
      </div>

      <div className="space-y-1.5 font-mono text-[13px]">
        <div className="text-ink">
          {name} <span className="text-muted">(${symbol})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-faint">contract</span>
          <span className="break-all text-acid">{mint58}</span>
          <button
            onClick={copyAddress}
            aria-label="Copy contract address"
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              copied ? "border-ok/50 text-ok" : "border-line-strong text-muted hover:border-acid/50 hover:text-acid"
            }`}
          >
            <Copy className="size-3" /> {copied ? "copied" : "copy"}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          {suffixOk ? (
            <span className="rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 text-ok">
              verified · ends in exact {MANDATORY_SUFFIX}
            </span>
          ) : (
            <span className="rounded-full border border-crimson/40 bg-crimson/10 px-2 py-0.5 text-crimson">
              suffix verification failed — contact support
            </span>
          )}
        </div>
        {creator58 && (
          <div className="break-all text-muted">
            <span className="text-faint">creator</span> {creator58}
          </div>
        )}
        {signature && <div className="break-all text-muted"><span className="text-faint">tx</span> {signature}</div>}
      </div>

      {/* Dev buy outcome — confirmed data only */}
      <div className="rounded-xl border border-line bg-raised/40 p-4 font-mono text-[12.5px]">
        {devBuy.enabled ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-acid">
              <span className="font-bold">DEV BUY · executed</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">SOL spent (incl. fees)</span>
              <span className="text-ink">
                {devBuy.solSpentSol != null ? `${devBuy.solSpentSol} SOL` : "verifying…"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">tokens received</span>
              <span className="text-ink">
                {devBuy.tokensReceived != null ? devBuy.tokensReceived : "not verifiable on-chain"}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-faint">
            Dev buy was off — you did not make an initial purchase through SpawnPad. The curve
            started empty; buy any time on pump.fun.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {signature && (
          <a
            href={`https://solscan.io/tx/${signature}${clusterQuery}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink transition-colors hover:bg-raised/60"
          >
            Solscan transaction <ExternalLink className="size-3.5" />
          </a>
        )}
        <a
          href={`https://pump.fun/${mint58}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-full bg-acid px-4 py-2 font-mono text-[12.5px] font-bold text-obsidian transition-colors hover:bg-[#7DF0FF]"
        >
          Token page <ExternalLink className="size-3.5" />
        </a>
        <button
          onClick={onReset}
          className="rounded-full border border-line-strong px-4 py-2 text-[13px] text-muted transition-colors hover:bg-raised/60 hover:text-ink"
        >
          Launch another
        </button>
      </div>
    </div>
  );
}
