import { NextResponse } from "next/server";
import { upsertLaunch, listLaunches, registryHealth } from "@/lib/server/store";
import { verifyLaunchSubmission } from "@/lib/server/verify";
import { reconcileKnownLaunches } from "@/lib/server/launch-reconciler";
import { getNetwork } from "@/lib/config";

/** Simple fixed-window rate limiter per IP (10 submissions / 10 min). */
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 10;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate limit exceeded" }, { status: 429 });
  }

  let body: { mint?: string; signature?: string; name?: string; symbol?: string; uri?: string; creator?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const { mint, signature, name, symbol, uri, creator } = body;
  if (!mint || !signature || !name || !symbol) {
    return NextResponse.json(
      { ok: false, error: "mint, signature, name and symbol are required" },
      { status: 400 }
    );
  }
  if (typeof name !== "string" || name.length > 64 || typeof symbol !== "string" || symbol.length > 16) {
    return NextResponse.json({ ok: false, error: "name/symbol length violations" }, { status: 400 });
  }

  const result = await verifyLaunchSubmission({
    mint,
    signature,
    network: getNetwork(),
  });

  const record = upsertLaunch({
    mint,
    signature,
    name,
    symbol,
    uri,
    creator,
    network: getNetwork(),
    launchedAt: Date.now(),
    verifiedAt: result.ok ? Date.now() : undefined,
    status: result.ok ? "verified" : "rejected",
    rejectionReason: result.ok ? undefined : result.reason,
    bondingCurve: result.bondingCurve,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.reason, status: record.status },
      { status: 422 }
    );
  }
  return NextResponse.json({ ok: true, record });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const verifiedOnly = url.searchParams.get("verified") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

  // Registry health first: a corrupt/unreadable store must surface as an
  // explicit degraded response — never as a fake empty success, and
  // reconciliation must not run (upserts would rewrite the unreadable file).
  const health = registryHealth();
  if (!health.readable) {
    return NextResponse.json(
      {
        ok: false,
        degraded: true,
        error: `launch registry unreadable: ${health.error}`,
        records: [],
      },
      { status: 500 }
    );
  }

  // Durable reconciliation: known SpawnPad launches missing from this
  // deployment's registry are re-verified on-chain and registered
  // (bounded, idempotent, backoff-scheduled). A fresh deployment
  // self-populates on its first Explore request.
  let reconciliation: Awaited<ReturnType<typeof reconcileKnownLaunches>> | undefined;
  let reconciliationError: string | undefined;
  try {
    reconciliation = await reconcileKnownLaunches();
  } catch (e: unknown) {
    reconciliationError = String((e as Error)?.message || e);
  }

  const records = listLaunches({ limit, verifiedOnly });
  return NextResponse.json({
    ok: true,
    records,
    reconciliation: reconciliation
      ? {
          registered: reconciliation.registered,
          failed: reconciliation.failed,
          deferredCount: reconciliation.deferred.length,
          skippedInFlight: reconciliation.skippedInFlight,
          remoteFeedUsed: reconciliation.remoteFeedUsed,
          remoteFeedError: reconciliation.remoteFeedError,
          passCooldownActive: reconciliation.passCooldownActive,
        }
      : undefined,
    reconciliationError,
  });
}
