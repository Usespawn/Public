/**
 * Pure feed filtering for SpawnPad's token listings.
 *
 * Extracted from TokenFeed so the rules are unit-testable
 * (tests/web/feed-filter.test.ts). Rules preserved exactly:
 *  - "live" and "graduated" tabs show verified launches (graduation data is
 *    not tracked yet — the tab is reserved, never a silent exclusion);
 *  - verified-only mode excludes pending/rejected records;
 *  - search matches name, symbol or mint (case-insensitive);
 *  - `limit` applies AFTER filtering, so new tokens are never pushed out.
 */

export interface FeedRecord {
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

export function filterLaunchRecords(
  records: FeedRecord[],
  opts: { tab?: FeedTab; query?: string; verifiedOnly?: boolean; limit?: number } = {}
): FeedRecord[] {
  let out = records;
  if (opts.verifiedOnly) out = out.filter((r) => r.status === "verified");
  if (opts.tab === "live") out = out.filter((r) => r.status === "verified");
  if (opts.tab === "graduated") out = out.filter((r) => r.status === "verified");
  const q = opts.query?.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q) ||
        r.mint.toLowerCase().includes(q)
    );
  }
  // Newest first by verified time (records may arrive unsorted from the API).
  out = [...out].sort((a, b) => (b.verifiedAt ?? b.launchedAt) - (a.verifiedAt ?? a.launchedAt));
  if (opts.limit != null) out = out.slice(0, opts.limit);
  return out;
}