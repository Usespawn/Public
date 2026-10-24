"use client";

/**
 * DEV BUY section — optional initial purchase by the connected creator wallet.
 * Pure presentational: all state lives in the launch flow so the panel can
 * never mutate the authorized amount on its own.
 */
import { useEffect, useState } from "react";
import { Info, RefreshCw, ShoppingBag } from "lucide-react";
import { DEV_BUY_PRESETS_SOL, DEV_BUY_MIN_SOL, DEV_BUY_MAX_SOL } from "@/lib/launch/devbuy";

export function DevBuyPanel({
  enabled,
  onToggle,
  amountSol,
  onSelectPreset,
  onCustomChange,
  wallet58,
  balanceLamports,
  estimateTokens,
  estimateLoading,
  estimateError,
  validationError,
  onRefreshBalance,
  disabled,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  amountSol: number;
  onSelectPreset: (sol: number) => void;
  onCustomChange: (sol: number) => void;
  wallet58: string | null;
  balanceLamports: number | null;
  estimateTokens: string | null;
  estimateLoading: boolean;
  estimateError: string | null;
  validationError: string | null;
  onRefreshBalance: () => void;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState<string>("");

  // Reflect the active amount in the custom field when presets are clicked.
  useEffect(() => {
    setCustom((prev) => {
      const isPreset = (DEV_BUY_PRESETS_SOL as readonly number[]).some(
        (p) => Math.abs(p - amountSol) < 1e-9
      );
      return isPreset ? "" : (prev === "" ? String(amountSol) : prev);
    });
  }, [amountSol]);

  const isPresetActive = (p: number) => Math.abs(p - amountSol) < 1e-9;

  const applyCustom = (raw: string) => {
    setCustom(raw);
    const v = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(v)) onCustomChange(v);
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold">
          02 · Dev buy <span className="ml-1 font-mono text-[11px] font-normal text-faint">optional</span>
        </h2>
        {/* Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable dev buy"
          disabled={disabled}
          onClick={() => onToggle(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
            enabled ? "border-acid/60 bg-acid/25" : "border-line bg-raised"
          }`}
        >
          <span
            className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-all ${
              enabled ? "left-6 bg-acid" : "left-1 bg-faint"
            }`}
          />
        </button>
      </div>

      {enabled ? (
        <>
          <p className="text-[13px] leading-relaxed text-muted">
            Buy some of your own token in the same transaction that creates it —
            funded and signed by your connected wallet. SpawnPad never touches
            your funds.
          </p>

          {/* Creator wallet + balance */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised/40 px-4 py-2.5 font-mono text-[12px]">
            <span className="flex items-center gap-2 text-muted">
              <ShoppingBag className="size-3.5 text-acid" />
              {wallet58
                ? `${wallet58.slice(0, 6)}…${wallet58.slice(-6)}`
                : "connect your wallet"}
            </span>
            <span className="flex items-center gap-2 text-faint">
              {balanceLamports != null
                ? `${(balanceLamports / 1e9).toFixed(4)} SOL available`
                : "balance —"}
              <button
                type="button"
                onClick={onRefreshBalance}
                disabled={disabled || !wallet58}
                title="Refresh balance"
                aria-label="Refresh balance"
                className="text-faint transition-colors hover:text-acid disabled:opacity-40"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </span>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-4 gap-2">
            {DEV_BUY_PRESETS_SOL.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => onSelectPreset(p)}
                className={`rounded-full border px-3 py-2 font-mono text-[12.5px] transition-colors disabled:opacity-50 ${
                  isPresetActive(p)
                    ? "border-acid/60 bg-acid/15 font-bold text-acid"
                    : "border-line-strong text-muted hover:border-acid/40 hover:text-acid"
                }`}
              >
                {p} SOL
              </button>
            ))}
          </div>

          {/* Custom amount + live estimate */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                Custom amount ({DEV_BUY_MIN_SOL}–{DEV_BUY_MAX_SOL} SOL)
              </span>
              <input
                className="input font-mono"
                inputMode="decimal"
                value={custom}
                disabled={disabled}
                onChange={(e) => applyCustom(e.target.value)}
                placeholder="e.g. 0.25"
              />
            </label>
            <div className="space-y-1 font-mono text-[12px]">
              <div className="flex justify-between">
                <span className="text-faint">Estimated purchase</span>
                <span className="text-ink">
                  {estimateLoading
                    ? "quoting…"
                    : estimateError
                      ? "quote unavailable"
                      : estimateTokens
                        ? `≈ ${estimateTokens} tokens`
                        : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">Est. fees + rent</span>
                <span className="text-ink">≈ 0.00261 SOL</span>
              </div>
            </div>
          </div>

          {estimateError && (
            <p className="flex items-center gap-2 font-mono text-[11.5px] text-warn">
              <Info className="size-3.5 shrink-0" /> {estimateError}
            </p>
          )}
          {validationError && (
            <p className="text-[12.5px] text-crimson">{validationError}</p>
          )}
        </>
      ) : (
        <p className="text-[13px] text-faint">
          Disabled — the token launches with an empty curve. You can buy later on pump.fun.
        </p>
      )}
    </div>
  );
}
