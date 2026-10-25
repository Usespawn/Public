"use client";

/**
 * Launch progress card — the five public states. Rendered INSTEAD of the form
 * while a launch is in flight. Cancellation is possible only before a
 * transaction is signed/submitted; after broadcast the card switches to
 * monitoring-only (no cancel, no resubmit).
 */
import { Ban, Check, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { ErrorLine } from "./ui";

export type LaunchPhase = "idle" | "grinding" | "preparing" | "wallet" | "submitting" | "success";

const STAGES = [
  { key: "grinding", label: "Preparing your token…" },
  { key: "preparing", label: "Preparing launch transaction…" },
  { key: "wallet", label: "Waiting for wallet confirmation…" },
  { key: "submitting", label: "Launching your token…" },
  { key: "success", label: "Token launched successfully!" },
] as const;

export function LaunchProgress({
  phase,
  subStatus,
  grind,
  error,
  submitted,
  signature,
  buySignature,
  clusterQuery,
  onCancel,
  onRetry,
  onRecheck,
  rechecking,
}: {
  phase: LaunchPhase;
  subStatus: string | null;
  grind: { attempts: number; aps: number; elapsed: number } | null;
  error: string | null;
  submitted: boolean;
  signature: string | null;
  /** Dev-buy transaction signature when it runs as a separate transaction. */
  buySignature?: string | null;
  /** "" on mainnet, "?cluster=devnet" otherwise. */
  clusterQuery: string;
  onCancel: () => void;
  onRetry: () => void;
  onRecheck: () => void;
  rechecking: boolean;
}) {
  const activeIdx = STAGES.findIndex((s) => s.key === phase);
  const cancellable = phase === "grinding" || phase === "preparing";
  // After a broadcast, failures are monitoring-only: re-verify, never re-send.
  const canRecheck = submitted && phase !== "success" && Boolean(signature);

  return (
    <div className="surface relative overflow-hidden rounded-2xl p-6 shadow-panel">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid/60 to-transparent" />
      <h2 className="font-display text-lg font-bold">Launching · SpawnPad</h2>

      <ol className="mt-5 space-y-3">
        {STAGES.map((s, i) => {
          const done = activeIdx > i;
          const active = activeIdx === i;
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${
                  done
                    ? "border-ok/50 bg-ok/15 text-ok"
                    : active
                      ? "border-acid/60 bg-acid/15 text-acid"
                      : "border-line bg-raised/50 text-faint"
                }`}
              >
                {done ? <Check className="size-3" /> : active ? <Loader2 className="size-3 animate-spin" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-[13.5px] ${active ? "font-semibold text-ink" : done ? "text-ok" : "text-faint"}`}>
                  {s.label}
                </div>
                {active && s.key === "grinding" && grind && (
                  <div className="mt-1 font-mono text-[11.5px] text-faint">
                    searching for a Spw mint · {(grind.aps || 0).toLocaleString()} keys/s
                  </div>
                )}
                {active && subStatus && s.key !== "grinding" && (
                  <div className="mt-1 font-mono text-[11.5px] text-muted">{subStatus}</div>
                )}
                {active && s.key === "submitting" && (
                  <div className="mt-1 font-mono text-[11.5px] text-warn">
                    broadcast — this can no longer be cancelled
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mt-4">
          <ErrorLine text={error} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {cancellable && !error && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] text-muted transition-colors hover:border-crimson/50 hover:text-crimson"
          >
            <Ban className="size-4" /> Cancel
          </button>
        )}
        {/* Pre-submission failure/cancel: safe to retry the whole flow. */}
        {!submitted && (phase === "grinding" || phase === "preparing") && error && (
          <button
            onClick={onRetry}
            className="rounded-full bg-acid px-6 py-2.5 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]"
          >
            Try again
          </button>
        )}
        {/* Post-submission failure: verification-only recheck — never resubmits. */}
        {canRecheck && (
          <button
            onClick={onRecheck}
            disabled={rechecking}
            className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink transition-colors hover:border-acid/50 hover:text-acid disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${rechecking ? "animate-spin" : ""}`} />
            Check status again
          </button>
        )}
        {signature && (
          <a
            href={`https://solscan.io/tx/${signature}${clusterQuery}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 font-mono text-[12.5px] text-muted transition-colors hover:border-acid/50 hover:text-acid"
          >
            tx {signature.slice(0, 8)}… <ExternalLink className="size-3.5" />
          </a>
        )}
        {buySignature && (
          <a
            href={`https://solscan.io/tx/${buySignature}${clusterQuery}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 font-mono text-[12.5px] text-muted transition-colors hover:border-acid/50 hover:text-acid"
          >
            dev buy {buySignature.slice(0, 8)}… <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
