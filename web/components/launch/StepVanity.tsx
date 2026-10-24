"use client";

/** Step 2: Spw vanity mint generation — the central SpawnPad feature.
 *  Futuristic mint-generation console. All progress values come from the
 *  real grinder; nothing is simulated here. */
import { useState } from "react";
import { Ban, Copy, Check, ShieldCheck, Cpu, ChevronRight } from "lucide-react";
import { MANDATORY_SUFFIX, isSpawnVanityAddress } from "@/lib/config";
import { expectedAttempts } from "@/lib/vanity/grinder";
import { VanityState } from "@/lib/vanity/state-machine";
import { ErrorLine } from "./ui";

export function StepVanity({
  state,
  workerCount,
  setWorkerCount,
  progress,
  mint58,
  error,
  onStart,
  onCancel,
  onContinue,
}: {
  state: VanityState;
  workerCount: number;
  setWorkerCount: (n: number) => void;
  progress: { attempts: number; aps: number; elapsed: number };
  mint58: string | null;
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const estimate = expectedAttempts(MANDATORY_SUFFIX);
  const eta = progress.aps > 0 ? Math.round(estimate / progress.aps) : null;
  const generating = state === VanityState.GENERATING;
  const validating = state === VanityState.VALIDATING;
  const ready = state === VanityState.READY_TO_LAUNCH;
  const mintVerified = mint58 ? isSpawnVanityAddress(mint58) : false;
  const idleish =
    state === VanityState.IDLE || state === VanityState.CANCELLED || state === VanityState.FAILED;

  const copy = async () => {
    if (!mint58) return;
    try {
      await navigator.clipboard.writeText(mint58);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="surface relative overflow-hidden rounded-xl shadow-panel">
      {/* Console chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid/60 to-transparent" />
      <div className="flex items-center justify-between border-b border-line bg-raised/60 px-5 py-3">
        <span className="font-mono text-[11.5px] tracking-[0.18em] text-muted">
          VANITY MINT CONSOLE <span className="text-acid">// 02</span>
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
            generating || validating
              ? "border-acid/40 bg-acid/10 text-acid"
              : ready
                ? "border-ok/40 bg-ok/10 text-ok"
                : "border-line bg-raised text-faint"
          }`}
        >
          {validating ? "validating" : generating ? "grinding" : ready ? "ready" : state.toLowerCase()}
        </span>
      </div>

      <div className="relative space-y-5 p-5">
        {/* Scanning line while generating */}
        {generating && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-scan bg-gradient-to-r from-transparent via-acid/70 to-transparent motion-reduce:animate-none" />
        )}

        <p className="max-w-xl text-[13.5px] leading-relaxed text-muted">
          Real Ed25519 keypairs are ground in your browser until the address ends
          in <span className="font-mono font-semibold text-acid">{MANDATORY_SUFFIX}</span>{" "}
          (~{estimate.toLocaleString()} expected attempts). Keys never leave your
          device, and this step cannot be skipped.
        </p>

        {/* Worker control */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <Cpu className="size-3.5 text-acid" /> Workers
          </label>
          <select
            className="input w-24"
            value={workerCount}
            onChange={(e) => setWorkerCount(Number(e.target.value))}
            disabled={generating}
            aria-label="Grinder worker count"
          >
            {[1, 2, 4, 6, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="font-mono text-[11.5px] text-faint">lower = cooler CPU</span>
        </div>

        {/* Live grind readout — real values only */}
        {generating && (
          <div className="rounded-lg border border-acid/30 bg-acid/[0.04] p-4">
            <div className="flex items-center gap-2 text-acid">
              <span className="animate-blink text-acid">▌</span>
              <span className="font-mono text-[13px]">grinding keypairs…</span>
            </div>
            <div className="mt-2 font-mono text-[13.5px] text-ink">
              {progress.attempts.toLocaleString()} attempts · {progress.aps.toLocaleString()} /s
              {progress.elapsed > 0 && (
                <span className="text-faint"> · {(progress.elapsed / 1000).toFixed(1)}s</span>
              )}
            </div>
            {eta !== null && (
              <div className="mt-1 font-mono text-[11.5px] text-faint">
                est. remaining ≈ {eta}s (rough — not a guarantee)
              </div>
            )}
            <button
              onClick={onCancel}
              className="mt-3 flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] text-muted transition-colors hover:border-crimson/50 hover:text-crimson"
            >
              <Ban className="size-4" /> Cancel
            </button>
          </div>
        )}

        {/* Start / resume */}
        {idleish && (
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-full bg-acid px-6 py-2.5 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]"
          >
            {state === VanityState.CANCELLED ? "Resume grinding" : "Start grinding"}
            <ChevronRight className="size-4" />
          </button>
        )}

        {/* Found address — character-reveal with exact Spw highlight */}
        {mint58 && !generating && (
          <div
            className={`rounded-xl border p-4 ${
              mintVerified ? "border-ok/40 bg-ok/[0.05]" : "border-crimson/40 bg-crimson/[0.05]"
            }`}
          >
            <div
              className={`flex items-center gap-2 font-mono text-[12.5px] ${
                mintVerified ? "text-ok" : "text-crimson"
              }`}
            >
              <ShieldCheck className="size-4" />
              {validating ? "validating…" : mintVerified ? "suffix verified — keypair re-derived locally" : "verification failed"}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-[14px] leading-relaxed tracking-wide" aria-label="Mint address">
                {mint58.split("").map((ch, i) => {
                  const isSpw = i >= mint58.length - MANDATORY_SUFFIX.length;
                  return (
                    <span
                      key={i}
                      className={`inline-block animate-revealChar motion-reduce:animate-none ${
                        isSpw
                          ? "rounded bg-acid/15 px-0.5 font-bold text-acid"
                          : "text-ink"
                      }`}
                      style={{ animationDelay: `${i * 18}ms` }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </code>
              <button
                onClick={copy}
                title="Copy mint address"
                aria-label="Copy mint address"
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11.5px] transition-colors ${
                  copied
                    ? "border-ok/50 text-ok"
                    : "border-line-strong text-muted hover:border-acid/50 hover:text-acid"
                }`}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "copied" : "copy"}
              </button>
            </div>
            {ready && (
              <button
                onClick={onContinue}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-acid px-6 py-2.5 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]"
              >
                Continue to validation <ChevronRight className="size-4" />
              </button>
            )}
          </div>
        )}

        {error && <ErrorLine text={error} />}
      </div>
    </div>
  );
}
