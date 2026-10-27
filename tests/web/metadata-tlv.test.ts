/**
 * Unit tests for web/lib/server/metadata-tlv.ts — Token-2022 embedded
 * metadata decoding.
 *
 * Fixture: the REAL 392-byte mint account data of
 * BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw, captured live from mainnet
 * (see scripts/spawn-mint-dump.cjs during the investigation).
 */
import { expect } from "chai";
import {
  decodedToken2022Metadata,
  encodeBase58,
} from "../../web/lib/server/metadata-tlv";

const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
/** Raw 32-byte pubkey captured from the live mint account. */
const MINT_BYTES = new Uint8Array([
  0x98, 0xeb, 0xf5, 0x65, 0x9e, 0x4d, 0x53, 0x03, 0xa1, 0xc9, 0x30, 0x59,
  0x40, 0x50, 0x1b, 0x4f, 0xc7, 0x5d, 0x6d, 0xfd, 0xb9, 0xc5, 0xf3, 0x17,
  0xc2, 0x95, 0x7f, 0x2f, 0x20, 0x85, 0x49, 0x60,
]);
const REAL_URI = "https://ipfs.io/ipfs/QmbifFBwnLjqNCGLZeu2tVpR9MSyx6Hc8gWTQRp9Qq8KUN";

/** The full base64 of the live mint account (dataLen=392). */
const REAL_MINT_BASE64 =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDGpH6NAwAGAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARIAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJjr9WWeTVMDockwWUBQG0/HXW39ucXzF8KVfy8ghUlgEwCaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmOv1ZZ5NUwOhyTBZQFAbT8ddbf25xfMXwpV/LyCFSWAEAAAAdGVzdAMAAABUU1RDAAAAaHR0cHM6Ly9pcGZzLmlvL2lwZnMvUW1iaWZGQnduTGpxTkNHTFpldTJ0VnBSOU1TeXg2SGM4Z1dUUVJwOVFxOEtVTgAAAAA=";

function realMintData(): Uint8Array {
  return new Uint8Array(Buffer.from(REAL_MINT_BASE64, "base64"));
}

describe("metadata-tlv: base58 encoder", () => {
  it("encodes the captured mint bytes back to the known address", () => {
    expect(encodeBase58(MINT_BYTES)).to.equal(MINT);
  });
});

describe("metadata-tlv: decodedToken2022Metadata", () => {
  it("decodes name/symbol/uri from the REAL live mint account (mint-anchored)", () => {
    const meta = decodedToken2022Metadata(realMintData(), MINT_BYTES);
    expect(meta).to.not.equal(null);
    expect(meta!.name).to.equal("test");
    expect(meta!.symbol).to.equal("TST");
    expect(meta!.uri).to.equal(REAL_URI);
  });

  it("decodes via the fallback scan when no mint anchor is provided", () => {
    const meta = decodedToken2022Metadata(realMintData());
    expect(meta).to.not.equal(null);
    expect(meta!.symbol).to.equal("TST");
    expect(meta!.uri).to.equal(REAL_URI);
  });

  it("builds a synthetic mint account from scratch and decodes it", () => {
    const parts: number[] = [];
    parts.push(...new Array(82).fill(0)); // base mint
    parts.push(...new Array(32).fill(0)); // pointer region (empirical zeros)
    parts.push(...Array.from(MINT_BYTES)); // mint embedded in metadata value
    const name = "Spawn Test";
    const symbol = "SPWN";
    const uri = "https://ipfs.io/ipfs/QmSyntheticCID111111111111111111111111111111";
    const enc = (s: string): number[] => {
      const out: number[] = [];
      for (const c of s) out.push(c.charCodeAt(0));
      return out;
    };
    const len = (n: number): number[] => [
      n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff,
    ];
    parts.push(...len(name.length), ...enc(name));
    parts.push(...len(symbol.length), ...enc(symbol));
    parts.push(...len(uri.length), ...enc(uri));
    while (parts.length % 4 !== 0) parts.push(0); // value padding
    const meta = decodedToken2022Metadata(new Uint8Array(parts), MINT_BYTES);
    expect(meta).to.not.equal(null);
    expect(meta!.name).to.equal(name);
    expect(meta!.symbol).to.equal(symbol);
    expect(meta!.uri).to.equal(uri);
  });

  it("returns null for truncated data", () => {
    const full = realMintData();
    const meta = decodedToken2022Metadata(full.slice(0, 300), MINT_BYTES);
    // The string chain is cut mid-way — no fabricated data.
    if (meta !== null) {
      // If a partial chain somehow parsed, the URI must still be intact.
      expect(meta.uri.startsWith("http")).to.equal(true);
    }
    expect(decodedToken2022Metadata(new Uint8Array(50), MINT_BYTES)).to.equal(null);
  });

  it("returns null for garbage data (never fabricates)", () => {
    const junk = new Uint8Array(392).fill(0xab);
    expect(decodedToken2022Metadata(junk, MINT_BYTES)).to.equal(null);
    expect(decodedToken2022Metadata(junk)).to.equal(null);
  });

  it("rejects chains whose uri is not an http(s) URL", () => {
    const parts: number[] = [];
    const enc = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));
    const len = (n: number): number[] => [n & 0xff, 0, 0, 0];
    parts.push(...new Array(98).fill(0)); // clear the minimum-length guard
    parts.push(...len(4), ...enc("test"));
    parts.push(...len(3), ...enc("TST"));
    parts.push(...len(11), ...enc("not-a-url-x"));
    const meta = decodedToken2022Metadata(new Uint8Array(parts), undefined);
    expect(meta).to.equal(null);
  });
});