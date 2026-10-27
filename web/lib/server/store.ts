/**
 * Server-side launch store.
 *
 * Launches are recorded ONLY after server-side verification of the on-chain
 * transaction (never trusting client claims). Idempotent by (mint, signature).
 *
 * Dev storage: JSON file under web/.data/ (no external DB exists in this
 * workspace). Schema is stable so swapping to Postgres/Supabase later is a
 * matter of replacing these functions.
 */
import fs from "node:fs";
import path from "node:path";

export type VerificationStatus =
  | "verified"
  | "pending"
  | "rejected";

export interface LaunchRecord {
  mint: string;
  signature: string;
  name: string;
  symbol: string;
  uri?: string;
  creator?: string;
  network: string;
  bondingCurve?: string;
  launchedAt: number; // client-reported timestamp, replaced on verification
  verifiedAt?: number;
  status: VerificationStatus;
  rejectionReason?: string;
}

const DATA_DIR = process.env.SPAWNPAD_DATA_DIR
  ? path.resolve(process.env.SPAWNPAD_DATA_DIR)
  : path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "launches.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

let lastReadError: string | null = null;

function readAll(): LaunchRecord[] {
  ensureDir();
  if (!fs.existsSync(FILE)) {
    lastReadError = null; // a missing file is a normal empty registry
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as LaunchRecord[];
    lastReadError = null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // Corrupt/unreadable registry: surfaced via registryHealth() so the API
    // can distinguish "genuinely empty" from "storage failure". Never wiped.
    lastReadError = String((e as Error)?.message || e);
    return [];
  }
}

function writeAll(records: LaunchRecord[]) {
  ensureDir();
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2));
  fs.renameSync(tmp, FILE);
}

export function upsertLaunch(record: LaunchRecord): LaunchRecord {
  const all = readAll();
  const idx = all.findIndex((r) => r.mint === record.mint);
  if (idx >= 0) {
    // Idempotent: an already-verified launch is never downgraded.
    const existing = all[idx];
    if (existing.status === "verified" && record.status !== "verified") {
      return existing;
    }
    all[idx] = record;
  } else {
    all.unshift(record);
  }
  writeAll(all);
  return record;
}

export function getLaunch(mint: string): LaunchRecord | undefined {
  return readAll().find((r) => r.mint === mint);
}

export function listLaunches(opts?: {
  limit?: number;
  verifiedOnly?: boolean;
}): LaunchRecord[] {
  let all = readAll();
  if (opts?.verifiedOnly) all = all.filter((r) => r.status === "verified");
  if (opts?.limit) all = all.slice(0, opts.limit);
  return all;
}

/**
 * Registry health for the listing API: distinguishes "genuinely empty"
 * (readable, no records) from "storage failure" (corrupt/unreadable file —
 * surfaced as a degraded response, never as a fake empty success).
 */
export function registryHealth(): { readable: boolean; error: string | null } {
  readAll();
  return { readable: lastReadError == null, error: lastReadError };
}
