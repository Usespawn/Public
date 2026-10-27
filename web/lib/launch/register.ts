/**
 * Client-side launch registration with bounded retries.
 *
 * Replaces the old fire-and-forget `void fetch(...).catch(() => undefined)`
 * that silently dropped registration failures: when the POST died (dev-server
 * recompile, transient error, rate limit), the verified launch never reached
 * SpawnPad's listing store and was invisible in every feed.
 *
 * Contract:
 *  - POST /api/launches first (fast path). If it fails, fall back to
 *    POST /api/launches/reconcile (server re-verifies on-chain).
 *  - At most `MAX_ATTEMPTS` network attempts total — bounded, no loops.
 *  - On persistent failure the payload is parked in localStorage
 *    (`spawnpad.pendingLaunch`); the feed reconciles it on its next load.
 *  - On success, dispatches `spawnpad:launches-updated` so open feeds refresh.
 *
 * The core is pure (injectable fetch/localStorage/now) and unit-tested in
 * tests/web/register.test.ts; the browser wrapper wires the DOM env.
 */

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 800;
export const PENDING_KEY = "spawnpad.pendingLaunch";
export const LAUNCHES_UPDATED_EVENT = "spawnpad:launches-updated";

export interface LaunchPayload {
  mint: string;
  signature: string;
  name: string;
  symbol: string;
  uri?: string;
  creator?: string;
  network: string;
}

export type RegistrationOutcome =
  | { state: "listed" }
  | { state: "pending"; attemptsUsed: number }
  | { state: "failed"; reason: string; attemptsUsed: number };

export interface RegistrationEnv {
  fetchImpl: typeof fetch;
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  } | null;
  dispatch: (type: string) => void;
  delay?: (ms: number) => Promise<void>;
}

export function readPendingLaunch(env: RegistrationEnv): LaunchPayload | null {
  try {
    const raw = env.storage?.getItem(PENDING_KEY) ?? null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LaunchPayload;
    if (!parsed || typeof parsed.mint !== "string" || typeof parsed.signature !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function parkPendingLaunch(payload: LaunchPayload, env: RegistrationEnv): void {
  try {
    env.storage?.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable — nothing else to do; registration stays best-effort */
  }
}

function clearPendingLaunch(env: RegistrationEnv): void {
  try {
    env.storage?.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyLaunchesUpdated(env: RegistrationEnv): void {
  try {
    env.dispatch(LAUNCHES_UPDATED_EVENT);
  } catch {
    /* ignore */
  }
}

/** One attempt against an endpoint; returns the parsed JSON or a failure tag. */
async function attempt(
  env: RegistrationEnv,
  url: string,
  payload: LaunchPayload
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await env.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let body: { ok?: boolean; error?: string } = {};
    try {
      body = (await res.json()) as { ok?: boolean; error?: string };
    } catch {
      /* non-JSON response body */
    }
    if (res.ok && body.ok) return { ok: true };
    return { ok: false, reason: body.error || `endpoint returned ${res.status}` };
  } catch (e) {
    return { ok: false, reason: String((e as Error)?.message || e) };
  }
}

/**
 * Registers a verified launch with the listing store. Bounded: at most
 * MAX_ATTEMPTS network calls, then the payload is parked for later
 * reconciliation. Never throws.
 */
export async function registerLaunch(
  payload: LaunchPayload,
  env: RegistrationEnv
): Promise<RegistrationOutcome> {
  let reason = "registration failed";
  let attemptsUsed = 0;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attemptsUsed = i + 1;
    const useReconcile = i > 0; // first attempt: fast path; retries: reconcile
    const result = await attempt(env, useReconcile ? "/api/launches/reconcile" : "/api/launches", payload);
    if (result.ok) {
      clearPendingLaunch(env);
      notifyLaunchesUpdated(env);
      return { state: "listed" };
    }
    reason = result.reason;
    if (i < MAX_ATTEMPTS - 1 && env.delay) {
      await env.delay(RETRY_DELAY_MS);
    }
  }
  parkPendingLaunch(payload, env);
  return { state: "pending", attemptsUsed };
}

/** Attempt-2 reconciliation used by the feed: verify + list a parked launch. */
export async function reconcileParkedLaunch(
  env: RegistrationEnv
): Promise<RegistrationOutcome> {
  const payload = readPendingLaunch(env);
  if (!payload) return { state: "listed" }; // nothing parked — nothing to do
  const result = await attempt(env, "/api/launches/reconcile", payload);
  if (result.ok) {
    clearPendingLaunch(env);
    notifyLaunchesUpdated(env);
    return { state: "listed" };
  }
  return { state: "pending", attemptsUsed: 1 };
}