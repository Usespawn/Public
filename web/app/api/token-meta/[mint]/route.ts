/**
 * GET /api/token-meta/[mint] — resolves a token's display metadata.
 *
 * Sources, in order (all read-only):
 *   1. the launch record's stored metadata URI (from the verified-launch
 *      registry), fetched through the IPFS gateway fallback chain;
 *   2. the mint account's own Token-2022 embedded metadata (works even when
 *      the launch record predates URI persistence);
 *   3. nothing — an honest null, never a fabricated logo.
 *
 * Responses are cached per mint (single-flight, 10 min TTL) so image views
 * never turn into a request per visitor. No secrets are involved or exposed.
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getRpcUrl } from "@/lib/config";
import { getLaunch } from "@/lib/server/store";
import { decodedToken2022Metadata } from "@/lib/server/metadata-tlv";
import {
  fetchMetadataJson,
  type ResolvedTokenMeta,
} from "@/lib/metadata/resolve";
import { isSafeImageUrl } from "@/lib/metadata/gateway";

/** Single-flight cache keyed by mint (10 min TTL). */
const cache = new Map<
  string,
  { at: number; value: ResolvedTokenMeta & { source: string } }
>();
const inflight = new Map<
  string,
  Promise<ResolvedTokenMeta & { source: string }>
>();
const TTL_MS = 10 * 60 * 1000;

function validBase58Mint(mint: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
}

async function resolveFresh(mint: string): Promise<ResolvedTokenMeta & { source: string }> {
  // 1) launch-record URI → gateway chain
  const record = getLaunch(mint);
  if (record?.uri) {
    const viaRecord = await fetchMetadataJson(record.uri, { fetchImpl: fetch });
    if (viaRecord) return { ...viaRecord.meta, source: "launch-record" };
  }

  // 2) on-chain Token-2022 embedded metadata (mint account itself)
  try {
    const connection = new Connection(getRpcUrl(), "confirmed");
    const info = await connection.getAccountInfo(new PublicKey(mint));
    const embedded = info ? decodedToken2022Metadata(info.data, new PublicKey(mint).toBytes()) : null;
    if (embedded?.uri) {
      // The embedded URI points at the metadata JSON — resolve its image.
      const viaChain = await fetchMetadataJson(embedded.uri, { fetchImpl: fetch });
      if (viaChain) return { ...viaChain.meta, source: "on-chain-metadata" };
      // Metadata JSON unreachable — still expose the embedded name/symbol
      // honestly, without inventing an image.
      return {
        name: embedded.name,
        symbol: embedded.symbol,
        description: null,
        image: null,
        resolvedVia: null,
        source: "on-chain-metadata",
      };
    }
  } catch {
    /* RPC hiccup — fall through to an honest null */
  }

  return {
    name: record?.name ?? null,
    symbol: record?.symbol ?? null,
    description: null,
    image: null,
    resolvedVia: null,
    source: "none",
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { mint: string } }
) {
  const mint = (params.mint || "").trim();
  if (!validBase58Mint(mint)) {
    return NextResponse.json({ ok: false, error: "invalid mint" }, { status: 400 });
  }

  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ ok: true, meta: hit.value });
  }
  let pending = inflight.get(mint);
  if (!pending) {
    pending = resolveFresh(mint)
      .then((value) => {
        cache.set(mint, { at: Date.now(), value });
        return value;
      })
      .finally(() => inflight.delete(mint));
    inflight.set(mint, pending);
  }
  const meta = await pending;

  // Defense in depth: never ship an unsafe URL to the browser.
  if (meta.image && !isSafeImageUrl(meta.image)) meta.image = null;
  return NextResponse.json({ ok: true, meta });
}