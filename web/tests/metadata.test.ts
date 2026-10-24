/**
 * Phase 3 metadata tests — file validation, metadata construction, URI
 * construction, and mocked IPFS upload success/failure paths.
 * No real network calls: fetch is stubbed per test.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateImageFile,
  sniffImageType,
  buildTokenMetadata,
  buildImageGatewayUrl,
  validateTokenMetadataInput,
  isIpfsHttpsUrl,
  isPlausibleCid,
  MAX_IMAGE_BYTES,
} from "../lib/metadata/upload";
import { pinataUploadFile, pinataUploadJson } from "../lib/metadata/pinata";
import { uploadMetadataToIpfs } from "../lib/metadata/upload-client";

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const GIF_BYTES = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2, 3, 4];

function makeFile(bytes: number[], name: string, type?: string): File {
  // NOTE: bytes must be wrapped in an array — node's File ctor iterates a bare
  // Uint8Array as a list of BlobParts (stringifying each byte) otherwise.
  return new File([new Uint8Array(bytes)], name, { type });
}

/* ---------------------------- file validation ---------------------------- */

test("validateImageFile: rejects wrong magic bytes even with ok extension", async () => {
  assert.match((await validateImageFile(makeFile(GIF_BYTES, "fake.png"))) ?? "", /not a valid/i);
});

test("validateImageFile: content sniffed vs extension mismatch", async () => {
  assert.match((await validateImageFile(makeFile(PNG_BYTES, "renamed.jpg"))) ?? "", /does not match its .jpg/);
});

test("validateImageFile: accepts real PNG / JPEG / WebP", async () => {
  assert.equal(await validateImageFile(makeFile(PNG_BYTES, "a.png")), null);
  assert.equal(await validateImageFile(makeFile(JPEG_BYTES, "a.jpg")), null);
  assert.equal(await validateImageFile(makeFile(JPEG_BYTES, "a.jpeg")), null);
  assert.equal(await validateImageFile(makeFile(WEBP_BYTES, "a.webp")), null);
});

test("validateImageFile: rejects oversize before reading content", async () => {
  // Only the size matters here — no valid magic bytes on purpose.
  const big = { name: "big.png", size: MAX_IMAGE_BYTES + 1, type: "image/png" };
  assert.match((await validateImageFile(big)) ?? "", /too large|5 MB/i);
});

test("validateImageFile: rejects empty file", async () => {
  assert.match((await validateImageFile(makeFile([], "empty.png"))) ?? "", /file is empty/);
});

test("validateImageFile: rejects wrong extension", async () => {
  assert.match((await validateImageFile(makeFile(PNG_BYTES, "image.gif"))) ?? "", /unsupported format/);
});

test("sniffImageType: magic bytes win over extension", () => {
  assert.equal(sniffImageType(new Uint8Array(PNG_BYTES)), "png");
  assert.equal(sniffImageType(new Uint8Array(JPEG_BYTES)), "jpeg");
  assert.equal(sniffImageType(new Uint8Array(WEBP_BYTES)), "webp");
  assert.equal(sniffImageType(new Uint8Array([1, 2, 3])), null);
});

/* ------------------------- metadata construction ------------------------- */

test("buildTokenMetadata: pump.fun schema with image and optional socials", () => {
  const meta = buildTokenMetadata({
    name: "  Spawn Coin  ",
    symbol: "spc",
    description: "A token",
    imageUrl: "https://gateway.test/ipfs/QmABC/img.png",
    website: "https://spawn.xyz",
    x: "@spawnpad",
    telegram: "@spawngroup",
  });
  assert.equal(meta.name, "Spawn Coin");
  assert.equal(meta.symbol, "SPC");
  assert.equal(meta.image, "https://gateway.test/ipfs/QmABC/img.png");
  assert.equal(meta.website, "https://spawn.xyz");
  assert.equal(meta.twitter, "@spawnpad");
  assert.equal(meta.telegram, "@spawngroup");
  assert.equal(meta.createdOn, "https://pump.fun");
  assert.equal(meta.showName, true);
});

test("buildTokenMetadata: omits empty socials", () => {
  const meta = buildTokenMetadata({
    name: "N", symbol: "NS", description: "", imageUrl: "https://g.test/ipfs/QmA/i.png",
  });
  assert.equal("website" in meta, false);
  assert.equal("twitter" in meta, false);
  assert.equal("telegram" in meta, false);
  assert.equal(meta.image, "https://g.test/ipfs/QmA/i.png");
});

test("buildTokenMetadata: throws when imageUrl is missing", () => {
  assert.throws(
    () => buildTokenMetadata({ name: "N", symbol: "NS", description: "", imageUrl: "" }),
    /no image/
  );
});

/* ------------------------ gateway URL construction ------------------------ */

test("buildImageGatewayUrl: default host, normalizes scheme/slash, rejects bad CID", () => {
  delete process.env.PINATA_GATEWAY;
  assert.equal(
    buildImageGatewayUrl("QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"),
    "https://ipfs.io/ipfs/QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"
  );
  process.env.PINATA_GATEWAY = "https://MyGateway.mypinata.cloud/";
  assert.equal(
    buildImageGatewayUrl("QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"),
    "https://mygateway.mypinata.cloud/ipfs/QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"
  );
  process.env.PINATA_GATEWAY = "mygateway.mypinata.cloud/ipfs";
  assert.equal(
    buildImageGatewayUrl("QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"),
    "https://mygateway.mypinata.cloud/ipfs/QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"
  );
  assert.throws(() => buildImageGatewayUrl("not-a-cid"), /plausible CID/);
  assert.throws(() => buildImageGatewayUrl("QmShort"), /plausible CID/);
  delete process.env.PINATA_GATEWAY;
});

test("isIpfsHttpsUrl + isPlausibleCid: guard the final metadata URI", () => {
  assert.equal(isIpfsHttpsUrl("https://ipfs.io/ipfs/QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"), true);
  assert.equal(isIpfsHttpsUrl("http://ipfs.io/ipfs/QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"), false);
  assert.equal(isIpfsHttpsUrl("data:application/json;base64,xxx"), false);
  assert.equal(isPlausibleCid("QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG"), true);
  assert.equal(isPlausibleCid("bafkreighdjk2qo5f5z7clnycbhtqjdb7nzgjpoeqj6d5jkuze"), true);
  assert.equal(isPlausibleCid("QmTooShort"), false);
});

test("validateTokenMetadataInput: name/symbol bounds", () => {
  const okImage = "https://g.test/ipfs/Qm" + "a".repeat(44);
  assert.match(validateTokenMetadataInput({ name: "x", symbol: "ABC", description: "", imageUrl: okImage }) ?? "", /2-64/);
  assert.match(validateTokenMetadataInput({ name: "a".repeat(65), symbol: "ABC", description: "", imageUrl: okImage }) ?? "", /2-64/);
  assert.match(validateTokenMetadataInput({ name: "Valid Name", symbol: "TOOLONGSYMBO", description: "", imageUrl: okImage }) ?? "", /2-10/);
  assert.equal(validateTokenMetadataInput({ name: "Valid Name", symbol: "VN", description: "", imageUrl: okImage }), null);
});

/* -------------------- mocked Pinata upload (no real network) -------------------- */

const REAL_FETCH = globalThis.fetch;
const CID = "QmVNRtKBBh4Ym1ezjSThDu8zRDVv8QYeoRkYgAhDhD9NrG";

function mockFetchOnce(impl: (...a: any[]) => Promise<any>): () => number {
  let called = 0;
  globalThis.fetch = ((input: any, init?: any) => {
    called++;
    return impl(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = REAL_FETCH;
    return called;
  };
}

test("pinataUploadFile: success → cid + resolvable gateway URL; JWT sent; endpoint correct", async () => {
  process.env.PINATA_JWT = "test-jwt-value";
  delete process.env.PINATA_GATEWAY;
  const restore = mockFetchOnce(async (input, init) => {
    assert.equal(String(input), "https://uploads.pinata.cloud/v3/files");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer test-jwt-value");
    assert.ok(init.body instanceof FormData);
    const form = init.body as FormData;
    assert.equal(form.get("network"), "public");
    assert.ok(form.get("file") instanceof Blob);
    return { ok: true, status: 200, json: async () => ({ data: { cid: CID, size: 12 } }) } as any;
  });
  try {
    const res = await pinataUploadFile({ name: "a.png", contentType: "image/png", bytes: new Uint8Array(PNG_BYTES) });
    assert.equal(res.cid, CID);
    assert.equal(res.url, `https://ipfs.io/ipfs/${CID}`);
    assert.match(res.url, /^https:\/\//);
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

test("pinataUploadFile: 401 → credentials error (secret never in message)", async () => {
  process.env.PINATA_JWT = "test-jwt-value";
  const restore = mockFetchOnce(async () =>
    ({ ok: false, status: 401, json: async () => ({}) }) as any
  );
  try {
    await assert.rejects(
      () => pinataUploadFile({ name: "a.png", contentType: "image/png", bytes: new Uint8Array(PNG_BYTES) }),
      /invalid or expired Pinata credentials/
    );
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

test("pinataUploadFile: 500 → provider error with status", async () => {
  process.env.PINATA_JWT = "x";
  const restore = mockFetchOnce(async () =>
    ({ ok: false, status: 503, json: async () => ({}) }) as any
  );
  try {
    await assert.rejects(
      () => pinataUploadFile({ name: "a.png", contentType: "image/png", bytes: new Uint8Array(PNG_BYTES) }),
      /HTTP 503/
    );
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

test("pinataUploadFile: malformed JSON response → explicit error", async () => {
  process.env.PINATA_JWT = "x";
  const restore = mockFetchOnce(async () =>
    ({ ok: true, status: 200, json: async () => { throw new Error("Unexpected token"); } }) as any
  );
  try {
    await assert.rejects(
      () => pinataUploadFile({ name: "a.png", contentType: "image/png", bytes: new Uint8Array(PNG_BYTES) }),
      /malformed/
    );
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

test("pinataUploadFile: 200 without cid → error, nothing returned", async () => {
  process.env.PINATA_JWT = "x";
  const restore = mockFetchOnce(async () =>
    ({ ok: true, status: 200, json: async () => ({ data: {} }) }) as any
  );
  try {
    await assert.rejects(
      () => pinataUploadFile({ name: "a.png", contentType: "image/png", bytes: new Uint8Array(PNG_BYTES) }),
      /missing CID/
    );
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

test("pinataUploadFile: network failure → wrapped clean error", async () => {
  process.env.PINATA_JWT = "x";
  const restore = mockFetchOnce(async () => { throw new Error("ECONNREFUSED"); });
  try {
    await assert.rejects(
      () => pinataUploadFile({ name: "a.png", contentType: "image/png", bytes: new Uint8Array(PNG_BYTES) }),
      /provider unreachable/
    );
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

test("pinataUploadFile: abort → timeout error", async () => {
  process.env.PINATA_JWT = "x";
  const restore = mockFetchOnce(async () => {
    const e = new Error("The operation was aborted");
    e.name = "AbortError";
    throw e;
  });
  try {
    await assert.rejects(
      () => pinataUploadFile({ name: "a.png", contentType: "image/png", bytes: new Uint8Array(PNG_BYTES) }),
      /timed out/i
    );
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

test("pinataUploadFile: missing credentials → config error", async () => {
  delete process.env.PINATA_JWT;
  await assert.rejects(
    () => pinataUploadFile({ name: "a.png", contentType: "image/png", bytes: new Uint8Array(PNG_BYTES) }),
    /PINATA_JWT/
  );
});

/* -------------------- mocked upload: metadata JSON -------------------- */

test("pinataUploadJson: JSON document uploaded; response carries cid + url", async () => {
  process.env.PINATA_JWT = "test-jwt-value";
  delete process.env.PINATA_GATEWAY;
  const restore = mockFetchOnce(async (input, init) => {
    const body = init.body as FormData;
    const f = body.get("file");
    assert.ok(f instanceof Blob);
    const parsed = JSON.parse(await (f as Blob).text());
    assert.equal(parsed.name, "Spawn Padcoin");
    assert.equal(parsed.symbol, "SPC");
    assert.match(parsed.image, /^https:\/\//);
    return { ok: true, status: 200, json: async () => ({ data: { cid: CID } }) } as any;
  });
  try {
    const res = await pinataUploadJson("SPC-Spawn_Padcoin.json", {
      name: "Spawn Padcoin", symbol: "SPC", description: "", image: `https://ipfs.io/ipfs/${CID}`,
    });
    assert.equal(res.cid, CID);
    assert.equal(res.url, `https://ipfs.io/ipfs/${CID}`);
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

test("pinataUploadJson: provider failure surfaces a clean status error", async () => {
  process.env.PINATA_JWT = "x";
  const restore = mockFetchOnce(async () =>
    ({ ok: false, status: 429, json: async () => ({}) }) as any
  );
  try {
    await assert.rejects(
      () => pinataUploadJson("m.json", { name: "N", symbol: "NS", description: "", image: `https://ipfs.io/ipfs/${CID}` }),
      /HTTP 429/
    );
  } finally {
    restore();
    delete process.env.PINATA_JWT;
  }
});

/* -------------------- browser metadata upload flow -------------------- */

test("uploadMetadataToIpfs: posts JSON to /api/metadata/json and validates the response", async () => {
  const imageUrl = `https://ipfs.io/ipfs/${CID}`;
  let seenBody: any = null;
  const restore = mockFetchOnce(async (input, init) => {
    assert.equal(String(input), "/api/metadata/json");
    assert.equal(init.method, "POST");
    seenBody = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => ({ ok: true, cid: CID, url: `https://ipfs.io/ipfs/${CID}` }) } as any;
  });
  try {
    const res = await uploadMetadataToIpfs({
      name: "Spawn Coin", symbol: "SPC", description: "the first spawn token", imageUrl,
    });
    assert.equal(seenBody.imageUrl, imageUrl);
    assert.equal(res.cid, CID);
    assert.equal(res.url, `https://ipfs.io/ipfs/${CID}`);
  } finally {
    restore();
  }
});

test("uploadMetadataToIpfs: HTTP 500 with non-JSON body → actionable error", async () => {
  const restore = mockFetchOnce(async () => ({ ok: false, status: 500 }) as any);
  try {
    await assert.rejects(
      () => uploadMetadataToIpfs({ name: "N", symbol: "NS", description: "", imageUrl: `https://ipfs.io/ipfs/${CID}` }),
      /metadata upload failed \(HTTP 500\)/
    );
  } finally {
    restore();
  }
});

test("uploadMetadataToIpfs: server error body is surfaced", async () => {
  const restore = mockFetchOnce(async () =>
    ({ ok: false, status: 422, json: async () => ({ ok: false, error: "imageUrl must be a public https IPFS URL" }) }) as any
  );
  try {
    await assert.rejects(
      () => uploadMetadataToIpfs({ name: "N", symbol: "NS", description: "", imageUrl: "https://bad" }),
      /imageUrl must be a public https IPFS URL/
    );
  } finally {
    restore();
  }
});