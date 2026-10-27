/**
 * Pure metadata-JSON resolution helpers (zero imports, injectable fetch).
 *
 * Given a token's metadata URI (launch record or on-chain), resolves the
 * IMAGE URL by trying every gateway candidate in order. Validation is strict:
 * only plain https/http(localhost) image URLs pass — the server never returns
 * a URL that fails isSafeImageUrl. Unit-tested in tests/web/resolve.test.ts.
 */
import {
  imageGatewayCandidates,
  isSafeImageUrl,
} from "./gateway";

export interface ResolvedTokenMeta {
  name: string | null;
  symbol: string | null;
  description: string | null;
  /** Validated image URL (already gateway-normalized) or null. */
  image: string | null;
  /** Gateway that successfully served the metadata JSON. */
  resolvedVia: string | null;
}

/** Extracts and validates display fields from a metadata JSON document. */
export function pickImageFromMetadataJson(raw: unknown): ResolvedTokenMeta {
  const meta: ResolvedTokenMeta = {
    name: null,
    symbol: null,
    description: null,
    image: null,
    resolvedVia: null,
  };
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return meta;
  const doc = raw as Record<string, unknown>;
  if (typeof doc.name === "string" && doc.name.trim()) meta.name = doc.name.trim().slice(0, 64);
  if (typeof doc.symbol === "string" && doc.symbol.trim()) meta.symbol = doc.symbol.trim().slice(0, 16);
  if (typeof doc.description === "string" && doc.description.trim()) {
    meta.description = doc.description.trim().slice(0, 2000);
  }
  const rawImage = doc.image ?? doc.image_url ?? doc.icon;
  if (typeof rawImage === "string") {
    const candidates = imageGatewayCandidates(rawImage);
    const safe = candidates.find((c) => isSafeImageUrl(c)) ?? null;
    meta.image = safe;
  }
  return meta;
}

export interface FetchMetadataOptions {
  fetchImpl: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetches the metadata document through every gateway candidate until one
 * returns JSON. Network errors, non-200s, non-JSON bodies and rate limits
 * simply advance to the next candidate; returns null when all fail.
 */
export async function fetchMetadataJson(
  uri: string,
  opts: FetchMetadataOptions
): Promise<{ meta: ResolvedTokenMeta; via: string } | null> {
  const candidates = imageGatewayCandidates(uri);
  for (const candidate of candidates) {
    try {
      const res = await opts.fetchImpl(candidate, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
      });
      if (!res.ok) continue;
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        continue; // non-JSON body — try the next gateway
      }
      const meta = pickImageFromMetadataJson(body);
      // Accept a document that yields at least a name or a valid image.
      if (meta.image || meta.name) {
        meta.resolvedVia = candidate;
        return { meta, via: candidate };
      }
    } catch {
      continue; // network/timeout — try the next gateway
    }
  }
  return null;
}