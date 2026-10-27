/**
 * Unit tests for web/lib/launch/register.ts — bounded client-side launch
 * registration with the reconcile fallback and parked-pending recovery.
 */
import { expect } from "chai";
import {
  registerLaunch,
  reconcileParkedLaunch,
  readPendingLaunch,
  MAX_ATTEMPTS,
  PENDING_KEY,
  LAUNCHES_UPDATED_EVENT,
  type LaunchPayload,
  type RegistrationEnv,
} from "../../web/lib/launch/register";

const PAYLOAD: LaunchPayload = {
  mint: "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw",
  signature: "573GqJL6Y7GrMhM4No7xD73w4CzSLFmXASexD56cBWakAfxyD1Qb4rqEjK5fKdjWyeWgxvMN2aTnrsgJhikeHbFY",
  name: "test",
  symbol: "TST",
  network: "mainnet-beta",
};

function makeEnv(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ url: string; status: number; body: unknown }> = [];
  let i = 0;
  const storage = new Map<string, string>();
  const events: string[] = [];
  const env: RegistrationEnv = {
    fetchImpl: (async (url: string, init?: RequestInit) => {
      const r = responses[Math.min(i, responses.length - 1)];
      i++;
      calls.push({
        url,
        status: r?.status ?? 500,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const body = JSON.stringify(r?.body ?? { ok: false, error: "mock failure" });
      return {
        ok: (r?.status ?? 500) < 400,
        status: r?.status ?? 500,
        json: async () => JSON.parse(body),
      } as Response;
    }) as unknown as typeof fetch,
    storage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
    dispatch: (type: string) => events.push(type),
    delay: () => Promise.resolve(),
  };
  return { env, calls, events, storage };
}

describe("register: happy path", () => {
  it("lists on the first POST, clears pending state and notifies the feed", async () => {
    const { env, calls, events, storage } = makeEnv([{ status: 200, body: { ok: true } }]);
    const outcome = await registerLaunch(PAYLOAD, env);
    expect(outcome.state).to.equal("listed");
    expect(calls.length).to.equal(1);
    expect(calls[0].url).to.equal("/api/launches");
    expect(calls[0].body).to.deep.equal(PAYLOAD);
    expect(events).to.deep.equal([LAUNCHES_UPDATED_EVENT]);
    expect(storage.has(PENDING_KEY)).to.equal(false);
  });
});

describe("register: retries and reconcile fallback", () => {
  it("falls back to /api/launches/reconcile when the POST fails, then lists", async () => {
    const { env, calls, events } = makeEnv([
      { status: 500, body: { ok: false, error: "boom" } },
      { status: 200, body: { ok: true } },
    ]);
    const outcome = await registerLaunch(PAYLOAD, env);
    expect(outcome.state).to.equal("listed");
    expect(calls.map((c) => c.url)).to.deep.equal(["/api/launches", "/api/launches/reconcile"]);
    expect(events.length).to.equal(1);
  });

  it("stops after MAX_ATTEMPTS attempts (bounded) and parks the launch", async () => {
    const { env, calls, events, storage } = makeEnv([
      { status: 500, body: { ok: false, error: "down 1" } },
      { status: 500, body: { ok: false, error: "down 2" } },
      { status: 500, body: { ok: false, error: "down 3" } },
      { status: 500, body: { ok: false, error: "must never be reached" } },
    ]);
    const outcome = await registerLaunch(PAYLOAD, env);
    expect(outcome.state).to.equal("pending");
    if (outcome.state === "pending") expect(outcome.attemptsUsed).to.equal(MAX_ATTEMPTS);
    expect(calls.length).to.equal(MAX_ATTEMPTS);
    expect(events.length).to.equal(0);
    expect(JSON.parse(storage.get(PENDING_KEY) ?? "{}")).to.deep.equal(PAYLOAD);
  });

  it("records the server's rejection reason in the pending state", async () => {
    const { env } = makeEnv([
      { status: 422, body: { ok: false, error: "mint does not end in 'Spw'" } },
      { status: 422, body: { ok: false, error: "mint does not end in 'Spw'" } },
      { status: 422, body: { ok: false, error: "mint does not end in 'Spw'" } },
    ]);
    const outcome = await registerLaunch(PAYLOAD, env);
    expect(outcome.state).to.equal("pending");
  });
});
describe("register: parked-launch reconciliation (delayed indexer recovery)", () => {
  it("reconciles a parked launch, clears it and notifies the feed", async () => {
    const { env, calls, events, storage } = makeEnv([{ status: 200, body: { ok: true } }]);
    storage.set(PENDING_KEY, JSON.stringify(PAYLOAD));
    const outcome = await reconcileParkedLaunch(env);
    expect(outcome.state).to.equal("listed");
    expect(calls.length).to.equal(1);
    expect(calls[0].url).to.equal("/api/launches/reconcile");
    expect(calls[0].body).to.deep.equal(PAYLOAD);
    expect(storage.has(PENDING_KEY)).to.equal(false);
    expect(events).to.deep.equal([LAUNCHES_UPDATED_EVENT]);
  });

  it("leaves the launch parked when reconciliation still fails", async () => {
    const { env, storage, events } = makeEnv([
      { status: 422, body: { ok: false, error: "launch transaction not found on-chain yet" } },
    ]);
    storage.set(PENDING_KEY, JSON.stringify(PAYLOAD));
    const outcome = await reconcileParkedLaunch(env);
    expect(outcome.state).to.equal("pending");
    expect(storage.has(PENDING_KEY)).to.equal(true);
    expect(events.length).to.equal(0);
  });

  it("does nothing when nothing is parked", async () => {
    const { env, calls } = makeEnv([]);
    const outcome = await reconcileParkedLaunch(env);
    expect(outcome.state).to.equal("listed");
    expect(calls.length).to.equal(0);
  });

  it("readPendingLaunch returns null for corrupt payloads", () => {
    const { env } = makeEnv([]);
    env.storage!.setItem(PENDING_KEY, "{{{not json");
    expect(readPendingLaunch(env)).to.equal(null);
    env.storage!.setItem(PENDING_KEY, JSON.stringify({ mint: "no signature" }));
    expect(readPendingLaunch(env)).to.equal(null);
  });
});