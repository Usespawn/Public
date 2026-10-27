/**
 * Pure IPFS gateway fallback + safe image URL helpers (zero imports).
 *
 * The launch flow pins metadata on the shortest gateway (`ipfs.io`) because
 * the on-chain create_v2 URI must fit Solana's 1232-byte packet limit — but
 * ipfs.io rate-limits aggressively (HTTP 429). Display therefore walks an
 * ordered gateway list until one serves the content. Unit-tested in
 * tests/web/gateway.test.ts.
 */

/** Gateways tried, in order, after the host embedded in the URL itself. */
export const FALLBACK_IPFS_GATEWAYS = [
  "ipfs.io",
  "gateway.pinata.cloud",
  "dweb.link",
  "cloudflare-ipfs.com",
] as const;

/** Loose CID sanity (mirrors lib/metadata/upload.ts): v0 Qm… or v1 baf…. */
export function isPlausibleCid(cid: string): boolean {
  if (!cid) return false;
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) return true;
  if (/^baf[a-z0-9]{20,}$/.test(cid)) return true;
  return false;
}

/** Extracts an IPFS CID from a bare CID, `ipfs://` URI or https gateway URL. */
export function extractIpfsCid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (isPlausibleCid(value)) return value;
  const m = value.match(/(?:^|\/)ipfs\/([1-9A-HJ-NP-Za-km-z]{8,})\/?$/);
  if (m && isPlausibleCid(m[1])) return m[1];
  if (/^ipfs:\/\//i.test(value)) {
    const cid = value.slice("ipfs://".length).replace(/\/+$/, "");
    if (isPlausibleCid(cid)) return cid;
  }
  return null;
}

/**
 * Ordered https gateway candidates for an image URL.
 *  - non-IPFS https URLs pass through unchanged (single candidate);
 *  - IPFS URLs are rebuilt on every known gateway, starting with the host
 *    embedded in the URL (it may be the configured dedicated gateway),
 *    then the fallbacks;
 *  - `ipfs://` and bare CIDs are resolved against every fallback gateway.
 * Returns at most `max` entries (deduplicated), default 6.
 */
export function imageGatewayCandidates(
  raw: unknown,
  max = 6
): string[] {
  if (typeof raw !== "string") return [];
  const value = raw.trim();
  const isHttpsUrl = /^https?:\/\//i.test(value);
  const isIpfsScheme = /^ipfs:\/\//i.test(value);
  const isBareCid = isPlausibleCid(value);
  if (!isHttpsUrl && !isIpfsScheme && !isBareCid) return []; // reject anything else

  const cid = extractIpfsCid(value);
  if (cid) {
    const hosts: string[] = [];
    if (isHttpsUrl) {
      try {
        const u = new URL(value);
        hosts.push(u.host); // the embedded host first (may be dedicated)
      } catch {
        /* fall through to defaults */
      }
    }
    for (const g of FALLBACK_IPFS_GATEWAYS) {
      if (!hosts.includes(g)) hosts.push(g);
    }
    return Array.from(new Set(hosts.slice(0, max).map((h) => `https://${h}/ipfs/${cid}`)));
  }

  // Plain https (non-IPFS) image URL — validated, single candidate.
  return isSafeImageUrl(value) ? [value] : [];
}

/**
 * Guards <img> sources: https (or localhost http for dev), no embedded
 * credentials, no data:/blob:/javascript: URLs, no control/space characters.
 */
export function isSafeImageUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim();
  if (!value) return false;
  if (/[<>"'\\\^`{|}\s]/.test(value)) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.protocol === "http:") {
      // Allow plain http only for local development hosts (any port).
      if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) return false;
    }
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}