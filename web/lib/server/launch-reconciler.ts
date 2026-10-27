/**
 * Server wiring for launch-registry reconciliation (singleton per process).
 *
 * Binds the pure planner (lib/launch/registry-reconciler.ts) to:
 *   - the committed seed list + optional remote feed (known-launches.ts),
 *   - the real on-chain verification + registration (server/reconcile.ts
 *     → verifyLaunchSubmission → Token-2022 metadata → atomic upsert).
 *
 * The listing API calls reconcileKnownLaunches() before serving records:
 * fresh deployments self-heal from the chain; retries are bounded and
 * deduplicated; failures never block the listing response.
 */
import { getNetwork } from "@/lib/config";
import { reconcileLaunch } from "@/lib/server/reconcile";
import {
  loadLaunchSeeds,
  type LaunchSeed,
} from "@/lib/server/known-launches";
import { getLaunch } from "@/lib/server/store";
import {
  createRegistryReconciler,
  type RegistryReconciler,
} from "@/lib/launch/registry-reconciler";

const SEEDS_TTL_MS = 10 * 60_000;
/** Cooldown between full passes when nothing needed reconciliation. */
export const PASS_COOLDOWN_MS = 30_000;

let cachedSeeds: {
  seeds: LaunchSeed[];
  at: number;
  remoteUsed: boolean;
  remoteError?: string;
} | null = null;

async function seedLookup(): Promise<{
  seedFor: (mint: string) => { signature?: string; name?: string; symbol?: string } | undefined;
  remoteUsed: boolean;
  remoteError?: string;
}> {
  if (!cachedSeeds || Date.now() - cachedSeeds.at > SEEDS_TTL_MS) {
    const loaded = await loadLaunchSeeds({
      feedUrl: process.env.SPAWNPAD_LAUNCH_FEED_URL || null,
    });
    cachedSeeds = {
      seeds: loaded.seeds,
      at: Date.now(),
      remoteUsed: loaded.remoteUsed,
      remoteError: loaded.remoteError,
    };
  }
  const byMint = new Map(cachedSeeds.seeds.map((s) => [s.mint, s]));
  return {
    seedFor: (mint) => byMint.get(mint),
    remoteUsed: cachedSeeds.remoteUsed,
    remoteError: cachedSeeds.remoteError,
  };
}

function buildReconciler(): RegistryReconciler {
  return createRegistryReconciler({
    maxVerifyPerPass: 3,
    isRegistered: (mint) => getLaunch(mint)?.status === "verified",
    reconcileOne: async (mint, seed) => {
      const result = await reconcileLaunch({
        mint,
        signature: seed?.signature,
        name: seed?.name,
        symbol: seed?.symbol,
        network: getNetwork(),
      });
      if (result.ok) {
        return { ok: true, alreadyListed: result.alreadyListed };
      }
      return { ok: false, reason: result.reason ?? "verification failed" };
    },
  });
}

let instance: RegistryReconciler | null = null;
let lastPassAt = 0;

/** Shared per-process reconciler instance. */
export function getLaunchReconciler(): RegistryReconciler {
  if (!instance) instance = buildReconciler();
  return instance;
}

/**
 * Reconciles known SpawnPad launches that are missing from this
 * deployment's registry. Bounded per pass (≤3 on-chain verifications),
 * deduplicated across concurrent requests, with per-mint backoff and a
 * short pass cooldown so Explore polling stays cheap. Mints that have never
 * been attempted are always allowed through the cooldown — that is what
 * lets a brand-new deployment populate itself on its very first request.
 */
export async function reconcileKnownLaunches(opts?: {
  maxVerifyPerPass?: number;
}): Promise<{
  registered: Array<{ mint: string; alreadyListed: boolean }>;
  failed: Array<{ mint: string; reason: string }>;
  deferred: Array<{ mint: string; reason: string }>;
  skippedInFlight: boolean;
  remoteFeedUsed: boolean;
  remoteFeedError?: string;
  seedsKnown: number;
  passCooldownActive: boolean;
}> {
  const { seedFor: _seedFor, remoteUsed, remoteError } = await seedLookup();
  const seedsKnown = cachedSeeds?.seeds.length ?? 0;

  const cooldownActive = Date.now() - lastPassAt < PASS_COOLDOWN_MS;
  const reconciler = getLaunchReconciler();
  const knownMints = cachedSeeds?.seeds.map((s) => s.mint) ?? [];
  const neverTried = knownMints.filter(
    (m) => reconciler.shouldAttempt(m) && getLaunch(m)?.status !== "verified"
  );

  const pass =
    cooldownActive && neverTried.length === 0
      ? { registered: [], failed: [], deferred: [], skippedInFlight: false }
      : await reconciler.reconcile(knownMints);

  lastPassAt = Date.now();
  return {
    registered: pass.registered.map((r) => ({
      mint: r.mint,
      alreadyListed: r.alreadyListed === true,
    })),
    failed: pass.failed.map((f) => ({ mint: f.mint, reason: f.reason ?? "failed" })),
    deferred: pass.deferred.map((d) => ({ mint: d.mint, reason: d.reason })),
    skippedInFlight: pass.skippedInFlight,
    remoteFeedUsed: remoteUsed,
    remoteFeedError: remoteError,
    seedsKnown,
    passCooldownActive: cooldownActive && neverTried.length === 0,
  };
}

/** Test/ops hook: resets the singleton + cooldown state. */
export function resetLaunchReconcilerForTests(): void {
  instance = null;
  cachedSeeds = null;
  lastPassAt = 0;
}