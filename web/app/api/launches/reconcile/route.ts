import { NextResponse } from "next/server";
import { reconcileLaunch } from "@/lib/server/reconcile";
import { getLaunch } from "@/lib/server/store";
import { getNetwork } from "@/lib/config";

/**
 * Launch reconciliation endpoint.
 *
 * Recovery path for launches whose client-side registration failed: SpawnPad
 * re-verifies the launch against the chain (create_v2 tx + bonding curve +
 * vanity mint co-sign) and persists the record only when it is fully
 * verified. Idempotent — an already-verified mint is returned as-is.
 *
 * Rate limiting: fixed window per IP, tighter than the launch POST because
 * each call performs bounded RPC work (max 2 history pages + 6 tx fetches).
 */
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 20;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate limit exceeded" }, { status: 429 });
  }

  let body: {
    mint?: string;
    signature?: string;
    name?: string;
    symbol?: string;
    uri?: string;
    creator?: string;
    network?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const { mint, signature, name, symbol, uri, creator, network } = body;
  if (!mint || typeof mint !== "string") {
    return NextResponse.json({ ok: false, error: "mint is required" }, { status: 400 });
  }
  if (signature && typeof signature !== "string") {
    return NextResponse.json({ ok: false, error: "signature must be a string" }, { status: 400 });
  }
  if ((name && typeof name !== "string") || (name && name.length > 64)) {
    return NextResponse.json({ ok: false, error: "name length violations" }, { status: 400 });
  }
  if ((symbol && typeof symbol !== "string") || (symbol && symbol.length > 16)) {
    return NextResponse.json({ ok: false, error: "symbol length violations" }, { status: 400 });
  }

  const result = await reconcileLaunch({
    mint,
    signature,
    name,
    symbol,
    uri,
    creator,
    network: getNetwork(),
  });

  if (!result.ok) {
    // Nothing is persisted for unverified mints — the caller gets the reason.
    return NextResponse.json({ ok: false, error: result.reason }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    record: result.record,
    alreadyListed: result.alreadyListed,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mint = url.searchParams.get("mint");
  if (!mint) {
    return NextResponse.json({ ok: false, error: "mint is required" }, { status: 400 });
  }
  const record = getLaunch(mint);
  if (!record || record.status !== "verified") {
    return NextResponse.json({ ok: true, record: null });
  }
  return NextResponse.json({ ok: true, record });
}