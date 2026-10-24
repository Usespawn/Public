"use client";

/**
 * Token feed backed by SpawnPad's verified-launch store.
 * Only server-verified launches are shown as SpawnPad launches — a matching
 * suffix alone is never enough (anti-claim protection).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Search, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LaunchRecord {
  mint: string;
  signature: string;
  name: string;
  symbol: string;
  creator?: string;
  status: string;
  verifiedAt?: number;
  launchedAt: number;
}

export type FeedTab = "all" | "live" | "graduated";

export function TokenFeed({
  title,
  defaultTab,
  verifiedOnly = true,
}: {
  title: string;
  defaultTab?: FeedTab;
  verifiedOnly?: boolean;
}) {
  const [tab, setTab] = useState<FeedTab>(defaultTab ?? "all");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<LaunchRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/launches?limit=100${verifiedOnly ? "&verified=1" : ""}`);
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
  }, [verifiedOnly]);

  const filtered = useMemo(() => {
    if (!records) return null;
    let out = records;
    if (tab === "live") out = out.filter((r) => r.status === "verified");
    if (tab === "graduated") out = out.filter((r) => r.status === "verified");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.symbol.toLowerCase().includes(q) ||
          r.mint.toLowerCase().includes(q)
      );
    }
    return out;
  }, [records, tab, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <span className="font-mono text-[11px] text-faint">
          {records ? `${records.length} record${records.length === 1 ? "" : "s"}` : "…"}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 rounded-full border border-line bg-raised/60 px-3 py-1.5 transition-colors focus-within:border-acid/50">
          <Search className="size-3.5 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="name, symbol or mint…"
            aria-label="Search launches"
            className="w-48 bg-transparent font-mono text-[13px] text-ink outline-none placeholder:text-faint"
          />
        </div>
        <div className="flex rounded-full border border-line bg-raised/60 p-1">
          {(["all", "live", "graduated"] as FeedTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={cn(
                "rounded-full px-3 py-1.5 font-mono text-[12px] capitalize transition-colors",
                tab === t
                  ? "bg-violet/20 text-violet shadow-glowv"
                  : "text-muted hover:text-ink"
              )}
            >
              {t === "live" ? "Live on Curve" : t === "graduated" ? "Graduated" : "All"}
            </button>
          ))}
        </div>
      </div>
      <FeedBody records={records} filtered={filtered} error={error} />
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="rounded-xl border border-line bg-panel/60 p-4">
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-xl bg-raised" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-raised" />
          <div className="h-2.5 w-1/4 animate-pulse rounded bg-raised" />
        </div>
      </div>
      <div className="mt-4 h-2.5 w-2/3 animate-pulse rounded bg-raised" />
    </div>
  );
}

function FeedBody({
  records,
  filtered,
  error,
}: {
  records: LaunchRecord[] | null;
  filtered: LaunchRecord[] | null;
  error: string | null;
}) {
  if (records === null && !error) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading launches">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="surface rounded-xl p-8 text-center text-sm text-muted">
        Launch feed unavailable: {error}
        <div className="mt-1 text-[12px] text-faint">
          (This is real data — an empty store simply means no verified launches yet.)
        </div>
      </div>
    );
  }
  if (filtered !== null && filtered.length === 0) {
    return (
      <div className="surface relative overflow-hidden rounded-xl p-10 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet/60 to-transparent" />
        <ShieldCheck className="mx-auto size-8 text-acid/60" />
        <p className="mt-3 text-sm text-ink">No verified SpawnPad launches yet.</p>
        <p className="mt-1 text-[12px] text-faint">
          Tokens are listed here only after server-side verification of the launch transaction.
        </p>
        <Link href="/launch" className="mt-5 inline-flex rounded-full bg-acid px-5 py-2.5 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]">
          Launch the first one →
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered?.map((r) => (
        <Link
          key={r.mint}
          href={`/token/${r.mint}`}
          className="group surface relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:border-acid/40 hover:shadow-glow motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {/* Illuminated top edge on hover */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet/15 font-display text-sm font-bold text-violet transition-colors group-hover:bg-acid/15 group-hover:text-acid">
              {r.symbol.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{r.name}</div>
              <div className="truncate font-mono text-[11px] text-faint">${r.symbol}</div>
            </div>
            <ArrowUpRight className="ml-auto size-4 shrink-0 text-faint opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-acid group-hover:opacity-100" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[11px]">
            <span className="truncate text-muted">
              {r.mint.slice(0, 6)}…<span className="text-acid">{r.mint.slice(-3)}</span>
            </span>
            <ShieldCheck className="size-3.5 shrink-0 text-ok" />
          </div>
          <div className="mt-1 font-mono text-[11px] text-faint">
            launched {new Date(r.verifiedAt || r.launchedAt).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
