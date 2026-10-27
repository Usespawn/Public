/**
 * Browser wiring for the launch-registration core (lib/launch/register.ts).
 * Real fetch + localStorage + CustomEvent dispatch.
 */
import {
  registerLaunch,
  reconcileParkedLaunch,
  readPendingLaunch,
  type LaunchPayload,
  type RegistrationEnv,
  type RegistrationOutcome,
} from "@/lib/launch/register";

function browserEnv(): RegistrationEnv {
  return {
    fetchImpl: (...args) => fetch(...args),
    storage: typeof window !== "undefined" && window.localStorage ? window.localStorage : null,
    dispatch: (type: string) => window.dispatchEvent(new CustomEvent(type)),
    delay: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  };
}

export function browserRegisterLaunch(payload: LaunchPayload): Promise<RegistrationOutcome> {
  return registerLaunch(payload, browserEnv());
}

export function browserReconcileParkedLaunch(): Promise<RegistrationOutcome> {
  return reconcileParkedLaunch(browserEnv());
}

export function browserReadPendingLaunch(network: string): LaunchPayload | null {
  const payload = readPendingLaunch(browserEnv());
  // Never reconcile cross-network: a devnet-parked launch must not be
  // verified against mainnet (and vice versa).
  if (payload && payload.network === network) return payload;
  return null;
}

export { LAUNCHES_UPDATED_EVENT } from "@/lib/launch/register";
export type { RegistrationOutcome } from "@/lib/launch/register";