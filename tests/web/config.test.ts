/**
 * Unit tests for web/lib/config.ts — network resolution (fail-closed) and the
 * exact case-sensitive `Spw` vanity suffix contract.
 */
import { expect } from "chai";

describe("config: getNetwork resolution (mainnet configuration)", () => {
  const configModule = "../../web/lib/config";
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.NEXT_PUBLIC_NETWORK;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_NETWORK;
    else process.env.NEXT_PUBLIC_NETWORK = saved;
    delete require.cache[require.resolve(configModule)];
  });

  function load() {
    delete require.cache[require.resolve(configModule)];
    return require(configModule) as typeof import("../../web/lib/config");
  }

  it("resolves NEXT_PUBLIC_NETWORK=mainnet to mainnet-beta", () => {
    process.env.NEXT_PUBLIC_NETWORK = "mainnet";
    expect(load().getNetwork()).to.equal("mainnet-beta");
  });

  it("resolves NEXT_PUBLIC_NETWORK=mainnet-beta to mainnet-beta", () => {
    process.env.NEXT_PUBLIC_NETWORK = "mainnet-beta";
    expect(load().getNetwork()).to.equal("mainnet-beta");
  });

  it("keeps devnet explicit and falls back to devnet on unknown values (fail-closed)", () => {
    process.env.NEXT_PUBLIC_NETWORK = "devnet";
    expect(load().getNetwork()).to.equal("devnet");
    process.env.NEXT_PUBLIC_NETWORK = "typo-mainet";
    expect(load().getNetwork()).to.equal("devnet");
    delete process.env.NEXT_PUBLIC_NETWORK;
    expect(load().getNetwork()).to.equal("devnet");
  });

  it("serves the mainnet RPC endpoint for mainnet configuration", () => {
    process.env.NEXT_PUBLIC_NETWORK = "mainnet-beta";
    delete process.env.NEXT_PUBLIC_SOLANA_RPC;
    const cfg = load();
    expect(cfg.getRpcUrl()).to.contain("api.mainnet-beta.solana.com");
  });

  it("prefers the explicit NEXT_PUBLIC_SOLANA_RPC when configured", () => {
    process.env.NEXT_PUBLIC_NETWORK = "mainnet-beta";
    process.env.NEXT_PUBLIC_SOLANA_RPC = "https://example-rpc.invalid";
    const cfg = load();
    expect(cfg.getRpcUrl()).to.equal("https://example-rpc.invalid");
    delete process.env.NEXT_PUBLIC_SOLANA_RPC;
  });
});

describe("config: exact case-sensitive Spw vanity contract", () => {
  const { isSpawnVanityAddress, MANDATORY_SUFFIX } = require("../../web/lib/config");

  it("accepts the real SpawnPad mint (ends in exact 'Spw')", () => {
    expect(MANDATORY_SUFFIX).to.equal("Spw");
    expect(isSpawnVanityAddress("BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw")).to.equal(true);
  });

  it("rejects case variants of the suffix (exact case requirement)", () => {
    expect(isSpawnVanityAddress("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAspw")).to.equal(false);
    expect(isSpawnVanityAddress("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASPW")).to.equal(false);
    expect(isSpawnVanityAddress("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsPW")).to.equal(false);
  });

  it("rejects wrong lengths and non-base58 characters", () => {
    expect(isSpawnVanityAddress("ShortSpw")).to.equal(false);
    expect(isSpawnVanityAddress("A".repeat(43) + "Spw")).to.equal(false); // 46 chars
    expect(isSpawnVanityAddress("0OIl" + "A".repeat(40) + "Spw")).to.equal(false);
    expect(isSpawnVanityAddress(null as unknown as string)).to.equal(false);
  });

  it("derives the bonding-curve PDA deterministically for the real mint", () => {
    const { bondingCurveAddress } = require("../../web/lib/config");
    expect(bondingCurveAddress("BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw")).to.equal(
      "2enJmTCXD8ufP512Nku1kRXWLZ3YstAYjzyGhRrfcz4J"
    );
  });
});