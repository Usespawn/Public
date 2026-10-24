"use client";

/**
 * Token detail page — live on-chain state from the official pump.fun program
 * via the configured RPC, plus the verified launch record from SpawnPad's
 * store. Market stats with no reliable provider are shown as unavailable.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, Ban, ExternalLink, Copy } from "lucide-react";
import { PUMP_PROGRAM_ID, bondingCurveAddress, isSpawnVanityAddress, getRpcUrl, getNetwork } from "@/lib/config";
import { Connection, PublicKey } from "@solana/web3.js";

interface CurveState {
  exists: boolean;
  complete: boolean | null;
  error?: string;
}

export function TokenDetail({ mint }: { mint: string }) {
  const validSuffix = isSpawnVanityAddress(mint);
  const [curve, setCurve] = useState<CurveState | null>(null);
  const [record, setRecord] = useState<{ name: string; symbol: string; signature: string; status: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const bc = bondingCurveAddress(mint);
        const connection = new Connection(getRpcUrl(), "confirmed");
        const info = await connection.getAccountInfo(new PublicKey(bc));
        if (!live) return;
        if (!info || !info.owner.equals(PUMP_PROGRAM_ID)) {
          setCurve({ exists: false, complete: null });
        } else {
          setCurve({ exists: true, complete: info.data.length > 8 + 64 ? info.data[8 + 64] === 1 : null });
        }
      } catch (e: any) {
        if (live) setCurve({ exists: false, complete: null, error: String(e?.message || e) });
      }
    })();
    (async () => {
      try {
        const r = await fetch(`/api/launches?limit=200`);
        const d = await r.json();
        if (!live || !d.ok) return;
        const rec = (d.records || []).find((x: any) => x.mint === mint);
        if (rec) setRecord(rec);
      } catch {
        /* optional enrichment */
      }
    })();
    return () => {
      live = false;
    };
  }, [mint]);

  const cluster = getNetwork() === "mainnet-beta" ? "" : "?cluster=devnet";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-14 place-items-center rounded-2xl bg-acid/15 font-display text-xl font-bold text-acid">
          {(record?.symbol || "SP").slice(0, 3)}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{record?.name || "Token"}</h1>
          <div className="font-mono text-[13px] text-faint">${record?.symbol || "—"}</div>
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
        <div className="grid gap-3 font-mono text-[13px] sm:grid-cols-2">
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-faint">bonding curve</span><span className="text-muted">{curve === null ? "…" : curve.exists ? "live" : "not found"}</span></div>
            <div className="flex justify-between"><span className="text-faint">graduated</span><span className="text-muted">{curve?.complete === true ? "yes" : curve?.complete === false ? "no" : "unknown"}</span></div>
            <div className="flex justify-between"><span className="text-faint">price / volume</span><span className="text-faint">unavailable (no market-data provider)</span></div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-faint">curve PDA</span><span className="truncate text-muted">{bondingCurveAddress(mint)}</span></div>
            {record?.signature && <div className="flex justify-between gap-2"><span className="shrink-0 text-faint">launch tx</span><span className="truncate text-muted">{record.signature.slice(0, 18)}…</span></div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <a href={`https://solscan.io/token/${mint}${cluster}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-acid px-4 py-2 font-mono text-[12.5px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]">
            Solscan <ExternalLink className="size-3.5" />
          </a>
          <a href={`https://pump.fun/${mint}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] hover:bg-raised/60">
            pump.fun <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <div className="glass rounded-2xl p-8 text-center text-[13px] text-faint">
        Price chart unavailable — market-data indexing is not configured in this build. No
        fabricated data is shown.
      </div>
    </div>
  );
}

export function UnavailableBadge({ label }: { label: string }) {
  return <span className="font-mono text-[12px] text-faint"><Ban className="mb-0.5 inline size-3" /> {label} n/a</span>;
}
