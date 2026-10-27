/**
 * Pure Token-2022 embedded-metadata decoder (zero imports).
 *
 * pump.fun create_v2 mints carry their metadata INSIDE the mint account via
 * the Token-2022 metadata extension. Empirical layout (validated against a
 * live mainnet SpawnPad launch, see tests/web/metadata-tlv.test.ts):
 *
 *   ... [32 bytes (pointer/authority region)][mint bytes (32)]
 *       [u32 LE nameLen][name][u32 LE symLen][symbol][u32 LE uriLen][uri]
 *       [zero padding to a 4-byte boundary]
 *
 * The decoder is intentionally conservative: it anchors on the mint's own
 * bytes when provided and requires three chained, length-prefixed printable
 * strings with an http(s) URI. Anything else returns null — the caller must
 * then refuse to list rather than fabricate token data.
 */

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58-encodes bytes (for matching a mint address inside account data). */
export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const d of digits) out = BASE58_ALPHABET[d] + out;
  // Leading zero bytes encode as '1'.
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out = "1" + out;
  return out;
}

function isPrintableRun(data: Uint8Array, start: number, length: number): boolean {
  if (start < 0 || length < 0 || start + length > data.length) return false;
  for (let i = start; i < start + length; i++) {
    const b = data[i];
    if (b < 0x20 || b > 0x7e) return false;
  }
  return true;
}

function decodeAscii(data: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length; i++) out += String.fromCharCode(data[i]);
  return out;
}

function readU32LE(data: Uint8Array, off: number): number | null {
  if (off + 4 > data.length) return null;
  return (data[off] | (data[off + 1] << 8) | (data[off + 2] << 16) | (data[off + 3] << 24)) >>> 0;
}

export interface EmbeddedTokenMetadata {
  name: string;
  symbol: string;
  uri: string;
}

/** Parses the chained [len][str]x3 structure at a fixed offset. */
function parseChainAt(
  data: Uint8Array,
  start: number
): EmbeddedTokenMetadata | null {
  const nameLen = readU32LE(data, start);
  if (nameLen == null || nameLen < 1 || nameLen > 64) return null;
  if (!isPrintableRun(data, start + 4, nameLen)) return null;
  const symOff = start + 4 + nameLen;
  const symLen = readU32LE(data, symOff);
  if (symLen == null || symLen < 1 || symLen > 16) return null;
  if (!isPrintableRun(data, symOff + 4, symLen)) return null;
  const uriOff = symOff + 4 + symLen;
  const uriLen = readU32LE(data, uriOff);
  if (uriLen == null || uriLen < 1 || uriLen > 256) return null;
  if (!isPrintableRun(data, uriOff + 4, uriLen)) return null;
  const name = decodeAscii(data, start + 4, nameLen);
  const symbol = decodeAscii(data, symOff + 4, symLen);
  const uri = decodeAscii(data, uriOff + 4, uriLen);
  if (!uri.startsWith("http")) return null;
  return { name, symbol, uri };
}

/**
 * Decodes embedded token metadata from a Token-2022 mint account's data.
 *
 * @param data        the mint account's raw data
 * @param mintBytes32 optional 32-byte mint pubkey for strict anchoring (the
 *                    metadata value embeds the mint before the strings)
 */
export function decodedToken2022Metadata(
  data: Uint8Array,
  mintBytes32?: Uint8Array
): EmbeddedTokenMetadata | null {
  if (!data || data.length < 128) return null;

  // Strict path: anchor on the last occurrence of the mint bytes; the
  // string chain begins exactly 32 bytes later (after the authority region).
  if (mintBytes32 && mintBytes32.length === 32) {
    for (let i = data.length - 32; i >= 0; i--) {
      let ok = true;
      for (let j = 0; j < 32; j++) {
        if (data[i + j] !== mintBytes32[j]) { ok = false; break; }
      }
      if (!ok) continue;
      const meta = parseChainAt(data, i + 32);
      if (meta) return meta;
    }
  }

  // Fallback: scan for the last plausible [len][name][len][symbol][len][uri]
  // chain anywhere in the data. Requiring an http(s) URI makes false
  // positives practically impossible on pump.fun mints.
  for (let i = data.length - 12; i >= 0; i--) {
    const meta = parseChainAt(data, i);
    if (meta) return meta;
  }
  return null;
}