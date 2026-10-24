"use client";

/**
 * Landing explorer preview — real records from the verified-launch store.
 * Empty state is honest: no fabricated tokens, no invented stats.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { MANDATORY_SUFFIX } from "@/lib/config";

interface LaunchRecord {
  mint: string;
  signature: string;
  name: string;
  symbol: string;
  status: string;
  verifiedAt?: number;
  launchedAt: number;
}

export function ExplorerPreview() {
  const [records, setRecords] = useState<LaunchRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/launches?limit=6&verified=1");
        const d = await r.json();
        if (!live) return;
        if (!d.ok) throw new Error(d.error || "failed to load");
        setRecords(d.records);
      } catch (e: any) {
        if (live) setError(String(e?.message || e));
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="atmos-alt relative border-b border-line">
      <div className="dot-matrix-fine pointer-events-none absolute inset-0" />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="tech-label">04 / THE ECOSYSTEM</span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Every launch has a{" "}
              <span className="bg-gradient-to-r from-acid to-violet bg-clip-text text-transparent">
                place
              </span>
              .
            </h2>
          </div>
          <Link
            href="/explore"
            className="inline-flex h-10 items-center rounded-full border border-line-strong bg-raised/60 px-5 font-mono text-[12px] font-bold tracking-wide text-ink transition-colors hover:border-acid/50 hover:text-acid"
          >
            [ EXPLORE ALL TOKENS ]
          </Link>
        </div>

        {records === null && !error && (
          <div className="surface flex items-center gap-2 rounded-xl p-10 text-muted">
            <Loader2 className="size-4 animate-spin" /> loading verified launches…
          </div>
        )}

        {error && (
          <div className="surface rounded-xl p-8 text-center text-[13px] text-muted">
            Feed unavailable: {error}
            <div className="mt-1 text-[12px] text-faint">
              (real data — an empty store means no verified launches yet)
            </div>
          </div>
        )}

        {records !== null && records.length === 0 && (
          <div className="surface rounded-xl p-10 text-center">
            <ShieldCheck className="mx-auto size-8 text-acid/60" />
            <p className="mt-3 text-[14px] text-ink">
              No verified SpawnPad launches yet — yours could be the first.
            </p>
            <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-faint">
              Tokens appear here only after SpawnPad verifies the actual launch transaction
              on-chain. An address ending in {MANDATORY_SUFFIX} without a verified launch is
              never listed.
            </p>
            <Link
              href="/launch"
              className="mt-5 inline-flex rounded-full bg-acid px-5 py-2.5 text-[13px] font-bold text-obsidian transition-colors hover:bg-acid/85"
            >
              Launch the first one →
            </Link>
          </div>
        )}



        {records !== null && records.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line shadow-panel">
            <table className="w-full text-left font-mono text-[12.5px]">
              <thead className="bg-raised/70 text-[11px] uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Mint</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Launched</th>
                  <th className="px-4 py-3 font-medium">Verified</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.mint} className="border-t border-line transition-colors hover:bg-raised/50">
                    <td className="px-4 py-3.5">
                      <Link href={`/token/${r.mint}`} className="group flex items-center gap-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-violet/15 font-display text-[10px] font-bold text-violet">
                          {r.symbol.slice(0, 3)}
                        </span>
                        <span>
                          <span className="block text-ink group-hover:text-acid">{r.name}</span>
                          <span className="block text-[11px] text-faint">${r.symbol}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-muted">
                        {r.mint.slice(0, 6)}…<span className="text-acid">{r.mint.slice(-3)}</span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3.5 text-faint sm:table-cell">
                      {new Date(r.verifiedAt || r.launchedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-ok">
                        <ShieldCheck className="size-3.5" /> ok
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <a
                        href={`https://pump.fun/${r.mint}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-acid hover:text-ink"
                        aria-label="Open on pump.fun"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
