"use client";

/**
 * Token detail page — real identity + real market data.
 *
 *  - Logo: /api/token-meta (launch-record URI → gateway fallback chain →
 *    on-chain Token-2022 metadata), rendered by TokenImage with honest
 *    loading/error/letter-avatar states. Nothing is ever fabricated.
 *  - Market: /api/market/[mint] — GeckoTerminal pool discovery + stats, or
 *    the REAL on-chain bonding-curve price while a token awaits indexing.
 *  - Chart: /api/market/[mint]/candles — genuine OHLCV only.
 */
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Ban,
  ExternalLink,
  Copy,
  Activity,
  Droplets,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import { bondingCurveAddress, isSpawnVanityAddress, getNetwork } from "@/lib/config";
import { TokenImage } from "@/components/TokenImage";
import { PriceChart } from "@/components/PriceChart";
import { formatUsdPrice, type MarketSummary } from "@/lib/market/types";

interface TokenMeta {
  name: string | null;
  symbol: string | null;
  description: string | null;
  image: string | null;
  source: string;
}

interface LaunchRecordLite {
  mint: string;
  name: string;
  symbol: string;
  signature: string;
  status: string;
}

function StatRow({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "muted" | "acid" | "crimson" | "warn";
}) {
  const toneClass =
    tone === "acid"
      ? "text-acid"
      : tone === "crimson"
        ? "text-crimson"
        : tone === "warn"
          ? "text-warn"
          : "text-muted";
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-faint">{label}</span>
      <span className={"truncate " + toneClass}>{value}</span>
    </div>
  );
}

function Pct({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) return <span>—</span>;
  const up = value >= 0;
  return (
    <span className={"inline-flex items-center gap-1 " + (up ? "text-acid" : "text-crimson")}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {up ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export function TokenDetail({ mint }: { mint: string }) {
  const validSuffix = isSpawnVanityAddress(mint);
  const [meta, setMeta] = useState<TokenMeta | null>(null);
  const [metaState, setMetaState] = useState<"loading" | "ready" | "error">("loading");
  const [record, setRecord] = useState<LaunchRecordLite | null>(null);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Token identity: name/symbol/logo via the metadata resolver.
  useEffect(() => {
    let live = true;
    setMetaState("loading");
    (async () => {
      try {
        const r = await fetch(`/api/token-meta/${mint}`);
        const d = (await r.json()) as { ok?: boolean; meta?: TokenMeta };
        if (!live) return;
        if (r.ok && d.ok && d.meta) {
          setMeta(d.meta);
          setMetaState("ready");
        } else {
          setMetaState("error");
        }
      } catch {
        if (live) setMetaState("error");
      }
    })();
    return () => {
      live = false;
    };
  }, [mint]);

  // Launch record (optional enrichment).
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/launches?limit=200`);
        const d = (await r.json()) as { ok?: boolean; records?: LaunchRecordLite[] };
        if (!live || !d.ok) return;
        const rec = (d.records || []).find((x) => x.mint === mint);
        if (rec) setRecord(rec);
      } catch {
        /* optional enrichment */
      }
    })();
    return () => {
      live = false;
    };
  }, [mint]);

  // Market summary: initial load + 60s polling while the tab is visible.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`/api/market/${mint}`);
        const d = (await r.json()) as { ok?: boolean; summary?: MarketSummary; error?: string };
        if (!live) return;
        if (r.ok && d.ok && d.summary) {
          setSummary(d.summary);
          setSummaryError(null);
        } else {
          setSummaryError(d.error || `HTTP ${r.status}`);
        }
      } catch (e) {
        if (live) setSummaryError(String((e as Error)?.message || e));
      } finally {
        if (live && document.visibilityState !== "hidden") {
          timer = setTimeout(tick, 60_000);
        }
      }
    };
    void tick();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !timer) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mint]);

  const cluster = getNetwork() === "mainnet-beta" ? "" : "?cluster=devnet";
  const displayName = meta?.name || record?.name || "Token";
  const displaySymbol = meta?.symbol || record?.symbol || "—";
  const status = summary?.status;
  const priceShown = summary?.priceUsd ?? summary?.curvePriceUsd ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <TokenImage
          uri={meta?.image ?? null}
          name={displayName}
          symbol={displaySymbol}
          className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-acid/15"
        />
        <div>
          <h1 className="font-display text-2xl font-bold">{displayName}</h1>
          <div className="font-mono text-[13px] text-faint">${displaySymbol}</div>
        </div>
        {record?.status === "verified" ? (
          <span className="flex items-center gap-1.5 rounded-full border border-acid/30 bg-acid/10 px-3 py-1.5 font-mono text-[12px] text-acid">
            <ShieldCheck className="size-3.5" /> verified SpawnPad launch
          </span>
        ) : validSuffix ? (
          <span className="rounded-full border border-warn/40 bg-warn/10 px-3 py-1.5 font-mono text-[12px] text-warn">
            Spw suffix — launch not verified via SpawnPad
          </span>
        ) : (
          <span className="rounded-full border border-line bg-raised/50 px-3 py-1.5 font-mono text-[12px] text-muted">
            not a SpawnPad mint (suffix mismatch)
          </span>
        )}
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <code className="break-all font-mono text-[13px] text-ink">{mint}</code>
          <button onClick={() => navigator.clipboard.writeText(mint)} className="text-muted hover:text-ink"><Copy className="size-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-acid">
              {summaryError ? "—" : status == null ? "…" : priceShown != null ? formatUsdPrice(priceShown) : "—"}
            </span>
            {summary?.change24hPct != null && (
              <span className="font-mono text-[13px]">
                <Pct value={summary.change24hPct} /> <span className="text-faint">24h</span>
              </span>
            )}
          </div>
          {summaryError ? (
            <span className="rounded-full border border-crimson/30 bg-crimson/10 px-2.5 py-1 font-mono text-[11px] text-crimson">
              market data error — retrying
            </span>
          ) : status === "indexed" ? (
            <span className="rounded-full border border-acid/30 bg-acid/10 px-2.5 py-1 font-mono text-[11px] text-acid">
              live market data · {summary?.priceSource === "geckoterminal" ? "GeckoTerminal" : (summary?.priceSource ?? "")}
            </span>
          ) : status === "provider-rate-limited" || status === "provider-unavailable" ? (
            <span className="rounded-full border border-warn/30 bg-warn/10 px-2.5 py-1 font-mono text-[11px] text-warn">
              provider {status === "provider-rate-limited" ? "rate-limited" : "unavailable"} — last snapshot shown
            </span>
          ) : status === "pending-discovery" ? (
            <span className="flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-2.5 py-1 font-mono text-[11px] text-warn">
              <Loader2 className="size-3 animate-spin" />
              awaiting indexing — live curve price
            </span>
          ) : status === "no-pool" ? (
            <span className="rounded-full border border-line bg-raised/50 px-2.5 py-1 font-mono text-[11px] text-muted">
              no tradable pool found
            </span>
          ) : null}
          {summary?.priceSource === "on-chain-bonding-curve" && !summary?.graduation?.completed ? (
            <span className="rounded-full border border-violet/30 bg-violet/10 px-2.5 py-1 font-mono text-[11px] text-violet">
              Pump.fun bonding-curve phase
            </span>
          ) : summary?.graduation?.completed ? (
            <span className="rounded-full border border-acid/30 bg-acid/10 px-2.5 py-1 font-mono text-[11px] text-acid">
              graduated → DEX pool
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 font-mono text-[13px] sm:grid-cols-2">
          <div className="space-y-1">
            <StatRow label="24h volume" value={summary?.volume24hUsd != null ? formatUsdPrice(summary.volume24hUsd) : "—"} />
            <StatRow label="liquidity / reserves" value={summary?.liquidityUsd != null ? formatUsdPrice(summary.liquidityUsd) : "—"} />
            <StatRow
              label="24h txns (buys/sells)"
              value={summary?.txns24h ? `${summary.txns24h.buys} / ${summary.txns24h.sells}` : "—"}
            />
          </div>
          <div className="space-y-1">
            <StatRow
              label="market source"
              tone={summary?.priceSource ? "acid" : "muted"}
              value={
                summary?.priceSource === "geckoterminal"
                  ? summary.pool?.kind === "pumpfun-curve"
                    ? "GeckoTerminal · bonding curve"
                    : "GeckoTerminal · DEX pool"
                  : summary?.priceSource === "on-chain-bonding-curve"
                    ? "on-chain curve reserves"
                    : "—"
              }
            />
            <StatRow label="curve PDA" value={bondingCurveAddress(mint)} />
            {summary?.graduation && (
              <StatRow
                label="graduation"
                value={
                  summary.graduation.completed
                    ? "completed"
                    : summary.graduation.percentage != null
                      ? `${summary.graduation.percentage}%`
                      : "not graduated"
                }
              />
            )}
            {record?.signature && (
              <StatRow label="launch tx" value={record.signature.slice(0, 18) + "…"} />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <a href={`https://solscan.io/token/${mint}${cluster}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-acid px-4 py-2 font-mono text-[12.5px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]">
            Solscan <ExternalLink className="size-3.5" />
          </a>
          <a href={`https://pump.fun/${mint}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] hover:bg-raised/60">
            pump.fun <ExternalLink className="size-3.5" />
          </a>
          {summary?.pool && (
            <a
              href={`https://www.geckoterminal.com/solana/pools/${summary.pool.address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] hover:bg-raised/60"
            >
              <Activity className="size-4" /> GeckoTerminal <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      <PriceChart mint={mint} />

      {meta?.description && (
        <div className="glass rounded-2xl p-5">
          <div className="mb-2 flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-faint">
            <Droplets className="size-3.5" /> about
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted">{meta.description}</p>
        </div>
      )}

      {metaState === "ready" && !meta?.image && (
        <div className="rounded-2xl border border-line bg-raised/30 p-4 font-mono text-[12px] text-faint">
          Logo unavailable —{" "}
          {meta?.source === "on-chain-metadata"
            ? "the on-chain metadata has no reachable image"
            : "no reachable metadata image was found for this token"}
          . No substitute is shown.
        </div>
      )}

      <div className="flex items-center gap-2 rounded-2xl border border-line bg-raised/30 p-4 font-mono text-[12px] text-faint">
        <Ban className="size-3.5 shrink-0" />
        All market figures come from verified sources (GeckoTerminal / on-chain state). When
        data is missing it is shown as missing — nothing is estimated or fabricated.
      </div>
    </div>
  );
}

export function UnavailableBadge({ label }: { label: string }) {
  return <span className="font-mono text-[12px] text-faint"><Ban className="mb-0.5 inline size-3" /> {label} n/a</span>;
}
