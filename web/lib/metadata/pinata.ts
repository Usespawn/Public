/**
 * SERVER-ONLY Pinata (IPFS) upload client — Pinata Files API v3.
 *
 * Verified against Pinata's currently documented OpenAPI spec:
 *   POST https://uploads.pinata.cloud/v3/files
 *   Auth:  Authorization: Bearer <PINATA_JWT>
 *   Body:  multipart/form-data — required: `file`, `network` (public|private);
 *          optional: `name`, `cid_version` (default v1 → CIDv1 `bafy…`)
 *   200:   { data: { id, name, cid, size, mime_type, is_duplicate, ... } }
 *
 * Security:
 *   - Throws when imported/called in a browser (credentials never ship to the
 *     client bundle; the Next.js build keeps this file server-side).
 *   - Credentials are read from PINATA_JWT and are never logged or returned.
 *   - The only upstream URL is the constant below — no client-supplied URL is
 *     ever fetched by the server.
 *   - Timeouts (AbortSignal), network failures, provider errors and malformed
 *     responses are all converted into clean, secret-free Error messages.
 */
import { buildImageGatewayUrl } from "./upload";

const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
const UPLOAD_TIMEOUT_MS = 60_000;

export interface PinataUploadResult {
  cid: string;
  size: number;
  /** Publicly resolvable https URL of the content (gateway + /ipfs/<cid>). */
  url: string;
}

function requireJwt(): string {
  if (typeof window !== "undefined") {
    throw new Error("Pinata credentials are server-only");
  }
  const jwt = process.env.PINATA_JWT;
  if (!jwt || !jwt.trim()) {
    throw new Error("IPFS upload not configured — set PINATA_JWT (server-only)");
  }
  return jwt;
}

/** Configured public gateway host, e.g. "ipfs.io". */
export function getIpfsGatewayHost(): string {
  return (process.env.PINATA_GATEWAY || "ipfs.io").trim();
}

/**
 * Uploads bytes to Pinata's PUBLIC IPFS network and returns the CID plus a
 * publicly resolvable https gateway URL. Throws on any failure with a clean,
 * secret-free message.
 */
export async function pinataUploadFile(opts: {
  name: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<PinataUploadResult> {
  const jwt = requireJwt();

  const form = new FormData();
  const blob = new Blob([opts.bytes as BlobPart], { type: opts.contentType });
  form.append("network", "public"); // required by the v3 API; public = resolvable
  form.append("file", blob, opts.name);
  form.append("name", opts.name);
  // CIDv0 (Qm…, 46 chars) on purpose: the token's on-chain create_v2 `uri`
  // embeds this URL in its instruction data and Solana rejects packets over
  // 1232 bytes — the launch transaction only fits with the shortest URI form
  // (a 59-char CIDv1 would add 13 bytes). CIDv0 is also pump.fun's own
  // metadata convention.
  form.append("cid_version", "v0");

  let res: Response;
  try {
    res = await fetch(PINATA_UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error(`IPFS upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`);
    }
    throw new Error("IPFS upload failed — provider unreachable");
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("IPFS upload rejected — invalid or expired Pinata credentials");
  }
  if (!res.ok) {
    throw new Error(`IPFS upload failed — provider returned HTTP ${res.status}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error("IPFS upload failed — malformed provider response");
  }
  const cid = (body as { data?: { cid?: unknown } })?.data?.cid;
  const size = (body as { data?: { size?: unknown } })?.data?.size;
  if (typeof cid !== "string" || !cid) {
    throw new Error("IPFS upload failed — provider response missing CID");
  }
  return {
    cid,
    size: typeof size === "number" ? size : 0,
    url: buildImageGatewayUrl(cid),
  };
}

/** Uploads a JSON token-metadata document and returns its CID + public URL. */
export async function pinataUploadJson(name: string, metadata: Record<string, unknown>): Promise<PinataUploadResult> {
  const bytes = new TextEncoder().encode(JSON.stringify(metadata));
  return pinataUploadFile({ name, contentType: "application/json", bytes });
}
