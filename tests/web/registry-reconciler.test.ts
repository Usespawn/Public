/**
 * Regression tests for the production-empty-Explore fix: the reconciliation
 * core that re-verifies missing known launches and registers only verified
 * records (idempotent, bounded, backoff-scheduled).
 */
import { expect } from "chai";
import {
  createRegistryReconciler,
} from "../../web/lib/launch/registry-reconciler";

const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const SIG =
  "573GqJL6Y7GrMhM4No7xD73w4CzSLFmXASexD56cBWakAfxyD1Qb4rqEjK5fKdjWyeWgxvMN2aTnrsgJhikeHbFY";

interface Harness {
  reconciler: ReturnType<typeof createRegistryReconciler>;
  registered: string[];
  verifyCalls: string[];
  failNext: Map<string, string>;
  advance: (ms: number) => void;
}

function makeHarness(opts?: { failFirst?: number }): Harness {
  let clock = 1_000_000;
  const registered: string[] = [];
  const verifyCalls: string[] = [];
  const failNext = new Map<string, string>();
  let remainingFails = opts?.failFirst ?? 0;

  const harness: Harness = {
    registered,
    verifyCalls,
    failNext,
    advance(ms: number) {
      clock += ms;
    },
    reconciler: null as unknown as ReturnType<typeof createRegistryReconciler>,
  };

  harness.reconciler = createRegistryReconciler({
    now: () => clock,
    maxVerifyPerPass: 3,
    isRegistered: (mint) => registered.includes(mint),
    reconcileOne: async (mint) => {
      verifyCalls.push(mint);
      const reason = failNext.get(mint);
      if (reason && remainingFails > 0) {
        remainingFails--;
        return { ok: false, reason };
      }
      registered.push(mint);
      return { ok: true };
    },
    seedFor: (mint) => (mint === MINT ? { signature: SIG } : undefined),
  });

  return harness;
}

describe("registry reconciler: fresh-deployment self-healing", () => {
  it("verifies and registers a known launch missing from the registry", async () => {
    const h = makeHarness();
    const pass = await h.reconciler.reconcile([MINT]);
    expect(pass.registered.map((r) => r.mint)).to.deep.equal([MINT]);
    expect(pass.failed).to.deep.equal([]);
    expect(h.verifyCalls).to.deep.equal([MINT]);
    expect(h.registered).to.deep.equal([MINT]);
  });

  it("is idempotent: an already-verified mint is never re-verified or duplicated", async () => {
    const h = makeHarness();
    await h.reconciler.reconcile([MINT]);
    const second = await h.reconciler.reconcile([MINT]);
    expect(second.registered).to.deep.equal([]); // isRegistered → skipped
    expect(h.verifyCalls.length).to.equal(1); // no second on-chain pass
    expect(h.registered.filter((m) => m === MINT).length).to.equal(1);
  });

  it("does NOT register a mint whose verification fails, and backs off", async () => {
    const h = makeHarness({ failFirst: 1 });
    h.failNext.set(MINT, "rpc error: upstream timeout");
    const first = await h.reconciler.reconcile([MINT]);
    expect(first.registered).to.deep.equal([]);
    expect(first.failed.length).to.equal(1);
    expect(first.failed[0].reason).to.contain("rpc error");
    expect(h.registered).to.deep.equal([]); // nothing fabricated

    // backoff: immediate retry deferred
    const immediate = await h.reconciler.reconcile([MINT]);
    expect(immediate.deferred.length).to.equal(1);
    expect(h.verifyCalls.length).to.equal(1);

    // after the backoff window the retry succeeds
    h.advance(31_000);
    const retry = await h.reconciler.reconcile([MINT]);
    expect(retry.registered.map((r) => r.mint)).to.deep.equal([MINT]);
  });

  it("stops retrying after the per-mint attempt budget", async () => {
    const h = makeHarness({ failFirst: 100 });
describe("registry reconciler: budget + concurrency", () => {
  it("caps work per pass (maxVerifyPerPass) and defers the rest", async () => {
    let clock = 1_000_000;
    const registered: string[] = [];
    const mints = [
      "MintA0000000000000000000000000000000000000Spw",
      "MintB0000000000000000000000000000000000000Spw",
      "MintC0000000000000000000000000000000000000Spw",
      "MintD0000000000000000000000000000000000000Spw",
    ];
    const reconciler = createRegistryReconciler({
      now: () => clock,
      maxVerifyPerPass: 2,
      isRegistered: (m) => registered.includes(m),
      reconcileOne: async (m) => {
        registered.push(m);
        return { ok: true };
      },
    });
    const pass = await reconciler.reconcile(mints);
    expect(registered.length).to.equal(2); // budget capped
    expect(pass.deferred.length).to.equal(2);
    clock += 1_000; // no backoff failures — budget is per pass
    const pass2 = await reconciler.reconcile(mints);
    expect(registered.length).to.equal(4);
    expect(pass2.deferred.length).to.equal(0);
  });

  it("deduplicates concurrent passes (in-flight guard)", async () => {
    let resolveVerify: (() => void) | null = null;
    const verifyCalls: string[] = [];
    const registered: string[] = [];
    const reconciler = createRegistryReconciler({
      isRegistered: (m) => registered.includes(m),
      reconcileOne: async (m) => {
        verifyCalls.push(m);
        await new Promise<void>((r) => {
          resolveVerify = r;
        });
        registered.push(m);
        return { ok: true };
      },
    });
    const first = reconciler.reconcile([MINT]);
    const second = await reconciler.reconcile([MINT]);
    expect(second.skippedInFlight).to.equal(true);
    resolveVerify!();
    await first;
    expect(verifyCalls.length).to.equal(1);
  });
});
    h.failNext.set(MINT, "still not indexed");
    for (let i = 0; i < 5; i++) {
      await h.reconciler.reconcile([MINT]);
      h.advance(20 * 60_000); // clear any backoff
    }
    const callsAfterBudget = h.verifyCalls.length;
    expect(callsAfterBudget).to.be.at.most(5);
    const later = await h.reconciler.reconcile([MINT]);
    expect(later.deferred[0].reason).to.contain("budget");
    expect(h.verifyCalls.length).to.equal(callsAfterBudget); // no more attempts
  });
});