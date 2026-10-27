/**
 * Server-side market registry — DURABLE persistence for indexing state
 * (mirrors lib/server/store.ts).
 *
 * Storage decision (documented per the hosting audit):
 *   - This build runs as a single long-lived Node process (VPS/self-hosted
 *     `next start` / `next dev`), where the JSON file under `web/.data/` IS
 *     durable across restarts and redeployments that preserve the volume.
 *   - It is NOT suitable for serverless/multi-instance hosting. When moving
 *     there, replace these functions with a real database (Postgres/Supabase)
 *     — the interface (read/write whole registry, upsert by mint) is stable
 *     and intentionally narrow. This is documented in the final report and
 *     NOT silently swapped for a new service in this change.
 *
 * File: `web/.data/market.json` (override with SPAWNPAD_DATA_DIR for tests).
 * Writes are atomic (tmp file + rename). No secrets are stored.
 */
import fs from "node:fs";
import path from "node:path";
import type { MarketRegistryEntry } from "../market/discovery";

const DATA_DIR = process.env.SPAWNPAD_DATA_DIR
  ? path.resolve(process.env.SPAWNPAD_DATA_DIR)
  : path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "market.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): MarketRegistryEntry[] {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(entries: MarketRegistryEntry[]) {
  ensureDir();
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
  fs.renameSync(tmp, FILE);
}

export function getMarketEntry(mint: string): MarketRegistryEntry | undefined {
  return readAll().find((e) => e.mint === mint);
}

/** Upserts by mint (one entry per mint — duplicate indexing is impossible). */
export function upsertMarketEntry(entry: MarketRegistryEntry): MarketRegistryEntry {
  const all = readAll();
  const idx = all.findIndex((e) => e.mint === entry.mint);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  writeAll(all);
  return entry;
}

export function listMarketEntries(): MarketRegistryEntry[] {
  return readAll();
}

/** True when the mint has a successfully indexed pool/curve (no upstream IO). */
export function isMarketReady(mint: string): boolean {
  const e = getMarketEntry(mint);
  return e?.indexed === true;
}