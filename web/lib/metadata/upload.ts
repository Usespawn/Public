/**
 * Token metadata: validation, construction, and IPFS URL building.
 *
 * Pure, framework-free helpers shared by:
 *   - the client (StepInfoForm / LaunchWizard)
 *   - the server API routes (app/api/metadata/*)
 *   - the unit tests (tests/metadata.test.ts)
 *
 * No secrets and no network calls live in this module.
 */

/** Initial image-size limit: 5 MB. Covers typical token art while keeping
 *  multipart uploads fast; enforced on BOTH client and server. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

/** Bytes → detected image type (or null). Magic-byte sniffing, not MIME-trusting. */
export function sniffImageType(bytes: Uint8Array): "png" | "jpeg" | "webp" | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "webp";
  }
  return null;
}

/** Extension of a filename, lowercased without the dot ("" if none). */
export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/**
 * Full client-side file validation — async because it reads the file's first
 * bytes to verify magic numbers (extension/MIME are never trusted alone).
 * The server still re-sniffs on its own; this is defense in depth.
 * Returns an error message, or null when the file is acceptable.
 */
export async function validateImageFile(
  file: { name: string; size: number; type?: string; slice?: Blob["slice"] }
): Promise<string | null> {
  if (!file || typeof file.size !== "number") return "no file selected";
  const ext = fileExtension(file.name);
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])) {
    return "unsupported format — use PNG, JPEG or WebP";
  }
  if (file.type && !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "unsupported format — use PNG, JPEG or WebP";
  }
  if (file.size <= 0) return "file is empty";
  if (file.size > MAX_IMAGE_BYTES) {
    return `image too large — max ${(MAX_IMAGE_BYTES / (1024 * 1024)).toFixed(0)} MB`;
  }
  // Magic-byte sniffing when we can read content (real File/Blob instances).
  if (typeof file.slice === "function") {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const sniffed = sniffImageType(head);
    if (!sniffed) return "file content is not a valid PNG, JPEG or WebP image";
    const extFamily: Record<string, string> = { png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp" };
    if (extFamily[ext] !== sniffed) {
      return `file content (${sniffed}) does not match its .${ext} extension`;
    }
  }
  return null;
}

/** Token metadata object in the Pump.fun-compatible shape. */
export interface TokenMetadataInput {
  name: string;
  symbol: string;
  description?: string;
  image: string;
  website?: string;
  x?: string;
  telegram?: string;
}

/** Builds the metadata document; the image MUST already be an IPFS URL. */
export function buildTokenMetadata(
  input: { name: string; symbol: string; description?: string; imageUrl?: string; website?: string; x?: string; telegram?: string }
): Record<string, unknown> {
  const image = (input.imageUrl ?? "").trim();
  if (!image) {
    throw new Error("no image URL — upload the image before building metadata");
  }
  const meta: Record<string, unknown> = {
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    description: input.description ?? "",
    image,
    showName: true,
    createdOn: "https://pump.fun",
  };
  if (input.website) meta.website = input.website;
  if (input.x) meta.twitter = input.x;
  if (input.telegram) meta.telegram = input.telegram;
  return meta;
}

/**
 * Validates the fields that will be embedded in metadata (used by the JSON
 * upload route and the client). Returns an error message, or null when valid.
 * Bounds mirror the launch wizard (pump.fun symbol limit is 10).
 */
export function validateTokenMetadataInput(input: {
  name?: unknown;
  symbol?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  website?: unknown;
  x?: unknown;
  telegram?: unknown;
}): string | null {
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.length > 64) {
    return "name must be 2-64 characters";
  }
  if (typeof input.symbol !== "string" || input.symbol.trim().length < 2 || input.symbol.length > 10) {
    return "symbol must be 2-10 characters";
  }
  if (typeof input.description !== "undefined" &&
    (typeof input.description !== "string" || input.description.length > 2000)) {
    return "description must be at most 2000 characters";
  }
  if (typeof input.imageUrl !== "string" || !isIpfsHttpsUrl(input.imageUrl)) {
    return "imageUrl must be a public https IPFS URL";
  }
  for (const key of ["website", "x", "telegram"] as const) {
    const v = input[key];
    if (typeof v !== "undefined" && (typeof v !== "string" || v.length > 200)) {
      return `${key} must be at most 200 characters`;
    }
  }
  return null;
}

/** True when `url` is a public https URL pointing at an IPFS CID. */
export function isIpfsHttpsUrl(url: string): boolean {
  if (!url.startsWith("https://")) return false;
  const rest = url.slice("https://".length);
  const slash = rest.indexOf("/");
  if (slash < 0) return false;
  const host = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  return host.length > 3 && path.startsWith("ipfs/") && isPlausibleCid(path.slice("ipfs/".length));
}

/** Loose CID sanity: v0 (Qm…, 46 base58 chars) or v1 (baf… multibase). */
export function isPlausibleCid(cid: string): boolean {
  if (!cid) return false;
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) return true;
  if (/^baf[a-z0-9]{20,}$/.test(cid)) return true;
  return false;
}

/**
 * Gateway used to build the token's ON-CHAIN metadata URI (the create_v2
 * `uri` argument). That URL is embedded verbatim in the transaction's
 * instruction data, and Solana rejects packets over 1232 bytes — the launch
 * transaction only fits with the shortest reliable public gateway. The
 * configured PINATA_GATEWAY (often a long dedicated host) stays in charge of
 * image DISPLAY urls; only this on-chain URI is size-critical.
 */
export const LAUNCH_METADATA_GATEWAY = "ipfs.io";

/**
 * Builds a publicly resolvable IPFS gateway URL.
 * Gateway: explicit host argument, else PINATA_GATEWAY, else "ipfs.io".
 * Accepts a bare host ("ipfs.io") or one with a scheme; strips any trailing
 * slash and any pre-existing /ipfs/ path so the CID can never be duplicated.
 */
export function buildImageGatewayUrl(cid: string, gateway?: string): string {
  if (!isPlausibleCid(cid)) throw new Error(`not a plausible CID: ${cid.slice(0, 12)}…`);
  let host = (gateway ?? process.env.PINATA_GATEWAY ?? "ipfs.io").trim().replace(/\/+$/, "");
  host = host.replace(/^https?:\/\//i, "");
  host = host.replace(/\/ipfs(\/.*)?$/i, "");
  host = host.toLowerCase(); // hosts are case-insensitive; normalize
  if (!host) throw new Error("gateway host is empty");
  return `https://${host}/ipfs/${cid}`;
}
