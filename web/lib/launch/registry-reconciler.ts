/**
 * Pure launch-registry reconciliation core (zero imports, injectable deps —
 * unit-tested in tests/web/registry-reconciler.test.ts).
 *
 * Purpose: a fresh deployment has an empty launch registry even though its
 * launches exist on-chain. This planner decides which KNOWN launch mints are
 * missing from the registry, runs a bounded verification pass for each, and
 * registers ONLY verified launches (idempotent by mint). Failures schedule
 * exponential-backoff retries (30s→…→16m, max 5 per process) so a flaky RPC
 * or not-yet-propagated mint never turns into request-per-visitor hammering.
 *
 * The caller injects:
 *   - isRegistered(mint): whether a VERIFIED record already exists
 *   - reconcileOne(mint, seed?): the real on-chain verification+registration
 *     (server wiring binds this to verifyLaunchSubmission / reconcileLaunch)
 *   - seedFor(mint): the seed entry (signature/name hints), when known
 */
export interface ReconcileOutcomeItem {
  mint: string;
  ok: boolean;
  alreadyListed?: boolean;
  reason?: string;
}

export interface ReconcilePassResult {
  /** Registered (newly or already-listed confirmed) during this pass. */
  registered: ReconcileOutcomeItem[];
  /** Attempted but not verified — scheduled for retry. */
  failed: ReconcileOutcomeItem[];
  /** Known mints skipped by the backoff/attempt budget this pass. */
  deferred: Array<{ mint: string; reason: string }>;
  /** True when another pass was already running (this call was deduped). */
  skippedInFlight: boolean;
}

export interface RegistryReconcilerOptions {
  now?: () => number;
  /** Max mints verified per pass — keeps listing latency bounded. */
  maxVerifyPerPass?: number;
  maxAttemptsPerMint?: number;
  /** Base backoff for a failed mint (doubles per attempt). */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  isRegistered: (mint: string) => boolean;
  reconcileOne: (
    mint: string,
    seed: { signature?: string; name?: string; symbol?: string } | undefined
  ) => Promise<{ ok: boolean; alreadyListed?: boolean; reason?: string }>;
  seedFor?: (mint: string) => { signature?: string; name?: string; symbol?: string } | undefined;
}

export interface RegistryReconciler {
  /** Runs one bounded pass over the given known mints. */
  reconcile(mints: string[]): Promise<ReconcilePassResult>;
  /** True when the mint can be attempted now (attempt budget + backoff). */
  shouldAttempt(mint: string): boolean;
  /** Diagnostics for the listing API response. */
  pendingMints(): string[];
}

export function createRegistryReconciler(
  opts: RegistryReconcilerOptions
): RegistryReconciler {
  const now = opts.now ?? (() => Date.now());
  const maxVerifyPerPass = opts.maxVerifyPerPass ?? 3;
  const maxAttempts = opts.maxAttemptsPerMint ?? 5;
  const baseBackoff = opts.baseBackoffMs ?? 30_000;
  const maxBackoff = opts.maxBackoffMs ?? 16 * 60_000;

  /** mint -> { count, nextAt } for FAILED verification attempts. */
  const attempts = new Map<string, { count: number; nextAt: number }>();
  let running = false;

  function backoffFor(count: number): number {
    const ms = baseBackoff * 2 ** Math.max(0, count - 1);
    return Math.min(ms, maxBackoff);
  }

  function shouldAttempt(mint: string): boolean {
    const a = attempts.get(mint);
    if (!a) return true;
    if (a.count >= maxAttempts) return false;
    return now() >= a.nextAt;
  }

  return {
    shouldAttempt(mint) {
      return shouldAttempt(mint);
    },

    pendingMints() {
      return Array.from(attempts.entries())
        .filter(([, a]) => a.count < maxAttempts)
        .map(([mint]) => mint);
    },

    async reconcile(mints): Promise<ReconcilePassResult> {
      const result: ReconcilePassResult = {
        registered: [],
        failed: [],
        deferred: [],
        skippedInFlight: false,
      };
      if (running) {
        result.skippedInFlight = true;
        return result;
      }
      running = true;
      try {
        let budget = maxVerifyPerPass;
        for (const mint of mints) {
          if (opts.isRegistered(mint)) continue; // already verified+listed
          if (!shouldAttempt(mint)) {
            const a = attempts.get(mint);
            result.deferred.push({
              mint,
              reason:
                a && a.count >= maxAttempts
                  ? "attempt budget exhausted for this process"
                  : "backing off after a failed attempt",
            });
            continue;
          }
          if (budget <= 0) {
            result.deferred.push({ mint, reason: "per-pass verification budget reached" });
            continue;
          }
          budget--;
          const seed = opts.seedFor?.(mint);
          let outcome: { ok: boolean; alreadyListed?: boolean; reason?: string };
          try {
            outcome = await opts.reconcileOne(mint, seed);
          } catch (e) {
            outcome = { ok: false, reason: String((e as Error)?.message || e) };
          }
          if (outcome.ok) {
            attempts.delete(mint); // success clears backoff bookkeeping
            result.registered.push({ mint, ok: true, alreadyListed: outcome.alreadyListed === true });
          } else {
            const prev = attempts.get(mint) ?? { count: 0, nextAt: 0 };
            const count = prev.count + 1;
            attempts.set(mint, { count, nextAt: now() + backoffFor(count) });
            result.failed.push({ mint, ok: false, reason: outcome.reason ?? "verification failed" });
          }
        }
      } finally {
        running = false;
      }
      return result;
    },
  };
}