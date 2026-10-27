/**
 * Phase-5 tests for the logo pipeline: IPFS gateway fallback, safe URL
 * validation, and metadata-JSON resolution — including the REAL recovered
 * metadata of the test token BHwesn…ZodSpw.
 */
import { expect } from "chai";
import {
  FALLBACK_IPFS_GATEWAYS,
  extractIpfsCid,
  imageGatewayCandidates,
  isSafeImageUrl,
} from "../../web/lib/metadata/gateway";
import {
  fetchMetadataJson,
  pickImageFromMetadataJson,
} from "../../web/lib/metadata/resolve";

const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
/** REAL on-chain metadata URI (embedded in the mint's Token-2022 data). */
const REAL_META_CID = "QmbifFBwnLjqNCGLZeu2tVpR9MSyx6Hc8gWTQRp9Qq8KUN";
const REAL_IMAGE_CID = "QmSbjG5SoYfZWWSe3ZDV2a18hw7byNCqTaE8DytPvH1jFQ";
/** REAL metadata document recovered live from gateway.pinata.cloud. */
const REAL_META_DOC = {
  name: "test",
  symbol: "TST",
  description: "tst",
  image: "https://gateway.pinata.cloud/ipfs/" + REAL_IMAGE_CID,
  showName: true,
  createdOn: "https://pump.fun",
};

describe("gateway: CID extraction", () => {
  it("extracts the real metadata CID from every supported URI shape", () => {
    expect(extractIpfsCid(REAL_META_CID)).to.equal(REAL_META_CID);
    expect(extractIpfsCid("https://gateway.pinata.cloud/ipfs/" + REAL_META_CID)).to.equal(REAL_META_CID);
    expect(extractIpfsCid("https://ipfs.io/ipfs/" + REAL_META_CID)).to.equal(REAL_META_CID);
    expect(extractIpfsCid("ipfs://" + REAL_META_CID)).to.equal(REAL_META_CID);
    expect(extractIpfsCid("https://example.com/not-ipfs")).to.equal(null);
    expect(extractIpfsCid(null)).to.equal(null);
  });
});

describe("gateway: candidate ordering and fallback", () => {
  it("starts with the URL's own host, then the fallback gateways (no dupes)", () => {
    const cands = imageGatewayCandidates("https://gateway.pinata.cloud/ipfs/" + REAL_META_CID);
    expect(cands[0]).to.equal("https://gateway.pinata.cloud/ipfs/" + REAL_META_CID);
    const hosts = cands.map((c) => c.split("/")[2]);
    const unique = new Set(hosts);
    expect(unique.size).to.equal(hosts.length);
    for (const g of FALLBACK_IPFS_GATEWAYS) {
      expect(hosts).to.include(g);
    }
  });

  it("resolves bare CIDs and ipfs:// URIs against every fallback gateway", () => {
    for (const input of [REAL_META_CID, "ipfs://" + REAL_META_CID]) {
      const cands = imageGatewayCandidates(input);
      expect(cands.length).to.equal(FALLBACK_IPFS_GATEWAYS.length);
      for (const c of cands) expect(c).to.contain("/ipfs/" + REAL_META_CID);
    }
  });

  it("rejects non-URL garbage and unsafe schemes", () => {
    expect(imageGatewayCandidates("javascript:alert(1)")).to.deep.equal([]);
    expect(imageGatewayCandidates("data:image/png;base64,AAAA")).to.deep.equal([]);
    expect(imageGatewayCandidates("not a url")).to.deep.equal([]);
    expect(imageGatewayCandidates(42)).to.deep.equal([]);
  });
});

describe("gateway: safe image URL validation", () => {
  it("accepts https and localhost http", () => {
    expect(isSafeImageUrl("https://gateway.pinata.cloud/ipfs/" + REAL_IMAGE_CID)).to.equal(true);
    expect(isSafeImageUrl("http://localhost:3000/x.png")).to.equal(true);
  });

  it("rejects credentials, junk characters and exotic schemes", () => {
    expect(isSafeImageUrl("https://user:pass@example.com/i.png")).to.equal(false);
    expect(isSafeImageUrl("ftp://example.com/i.png")).to.equal(false);
    expect(isSafeImageUrl("https://example.com/i.png with space")).to.equal(false);
    expect(isSafeImageUrl('javascript:alert("x")')).to.equal(false);
    expect(isSafeImageUrl(undefined)).to.equal(false);
  });
});

describe("resolve: metadata JSON → image", () => {
  it("extracts the REAL test-token image (recovery proof)", () => {
    const meta = pickImageFromMetadataJson(REAL_META_DOC);
    expect(meta.name).to.equal("test");
    expect(meta.symbol).to.equal("TST");
    expect(meta.image).to.equal("https://gateway.pinata.cloud/ipfs/" + REAL_IMAGE_CID);
    expect(meta.description).to.equal("tst");
  });

  it("keeps name/symbol even when the image URL is unsafe (never fabricates)", () => {
    const meta = pickImageFromMetadataJson({
      name: "x",
      symbol: "X",
      image: "data:image/png;base64,AAAA",
    });
    expect(meta.image).to.equal(null);
    expect(meta.name).to.equal("x");
  });

  it("returns nulls for non-object payloads", () => {
    expect(pickImageFromMetadataJson("nope").image).to.equal(null);
    expect(pickImageFromMetadataJson(null).image).to.equal(null);
  });

  it("fetches through the gateway chain, skipping failures until one works", async () => {
    const urlsHit: string[] = [];
    const fetchImpl = (async (input: string) => {
      urlsHit.push(String(input));
      const isPinata = String(input).includes("gateway.pinata.cloud");
      return {
        ok: isPinata,
        status: isPinata ? 200 : 429,
        json: async () =>
          isPinata
            ? REAL_META_DOC
            : Promise.reject(new Error("not json")),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const out = await fetchMetadataJson("ipfs://" + REAL_META_CID, { fetchImpl });
    expect(out).to.not.equal(null);
    expect(out!.meta.image).to.equal("https://gateway.pinata.cloud/ipfs/" + REAL_IMAGE_CID);
    expect(out!.via).to.contain("gateway.pinata.cloud");
    expect(urlsHit.length).to.be.greaterThan(1); // a failing gateway was skipped
  });

  it("returns null when every gateway fails (honest no-logo state)", async () => {
    const fetchImpl = (async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const out = await fetchMetadataJson("ipfs://" + REAL_META_CID, { fetchImpl });
    expect(out).to.equal(null);
  });
});