/**
 * Unit tests for web/lib/server/tx-inspect.ts — the v0-proof launch
 * transaction inspection used by server-side verification.
 *
 * Fixtures are ground truth captured from the live mainnet SpawnPad launch of
 * mint BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw:
 *  - create tx  573GqJL6…: create_v2 (data prefix "2EYfNEVD2g59") + buy
 *  - the instruction data in jsonParsed responses is base58-encoded
 */
import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import {
  CREATE_V2_DISCRIMINATOR,
  decodeBase58,
  decodeInstructionData,
  extractPumpInstructions,
  flatParsedAccountKeys,
  parsedAccountMetas,
  parsedTxIsSpawnCreate,
} from "../../web/lib/server/tx-inspect";
import { encodeBase58 } from "../../web/lib/server/metadata-tlv";

const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const PAYER = "8tnPCTZBe1KWRSshZQdGf2b7GXS63YR57dL25pk1ALNS";
const BC = "2enJmTCXD8ufP512Nku1kRXWLZ3YstAYjzyGhRrfcz4J";
const PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const COMPUTE = "ComputeBudget111111111111111111111111111111";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

/** The REAL parsed create transaction captured live from mainnet. */
function realCreateTx(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "create-tx-mainnet.json"), "utf8")
  );
}

describe("tx-inspect: base58 + instruction data decoding", () => {
  /** The REAL full create_v2 instruction data (base58), from the captured
   * mainnet fixture — base58 is positional, so prefixes cannot be decoded
   * in isolation. */
  const realCreateV2Data = (): string => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "fixtures", "create-tx-mainnet.json"), "utf8")
    ) as { transaction: { message: { instructions: Array<{ programId: string; data: string }> } } };
    return fixture.transaction.message.instructions.find(
      (ix) => ix.programId === PUMP
    )!.data;
  };

  it("decodes the real create_v2 discriminator from the live transaction", () => {
    const bytes = decodeBase58(realCreateV2Data());
    expect(Array.from(bytes.slice(0, 8))).to.deep.equal(Array.from(CREATE_V2_DISCRIMINATOR));
  });

  it("decodes the real buy discriminator from the live transaction", () => {
    // buy = 66063d1201daebea (from the vendored pump-sdk IDL) — the create tx
    // bundles create_v2 + buy (dev buy), so the second pump instruction is it.
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "fixtures", "create-tx-mainnet.json"), "utf8")
    ) as { transaction: { message: { instructions: Array<{ programId: string; data: string }> } } };
    const buyData = fixture.transaction.message.instructions
      .filter((ix) => ix.programId === PUMP)
      .map((ix) => ix.data)[1];
    expect(Array.from(decodeBase58(buyData).slice(0, 8))).to.deep.equal([
      0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea,
    ]);
  });

  it("round-trips arbitrary bytes through base58", () => {
    const raw = new Uint8Array([0, 0, 1, 255, 0x98, 0xeb, 0xf5, 0x00, 0x42]);
    expect(Array.from(decodeBase58(encodeBase58(raw)))).to.deep.equal(Array.from(raw));
  });

  it("returns empty bytes for invalid base58 input", () => {
    expect(decodeBase58("0OIl-not-base58").length).to.equal(0);
    expect(decodeBase58(null as unknown as string).length).to.equal(0);
  });

  it("decodeInstructionData handles base58 strings, byte arrays and junk", () => {
    const raw = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(Array.from(decodeInstructionData(encodeBase58(raw)))).to.deep.equal(Array.from(raw));
    expect(Array.from(decodeInstructionData(raw))).to.deep.equal(Array.from(raw));
    expect(Array.from(decodeInstructionData([9, 8, 7, 6, 5, 4, 3, 2]))).to.deep.equal([9, 8, 7, 6, 5, 4, 3, 2]);
    expect(decodeInstructionData(undefined).length).to.equal(0);
  });
});
/** Builds a parsed-transaction shape mirroring the real v0 create tx. */
function buildParsedTx(overrides?: {
  mintSigner?: boolean;
  createIxAccountsIncludeMint?: boolean;
  txErr?: unknown;
  includeCreate?: boolean;
  accountKeyStyle?: "objects" | "strings";
}) {
  const mintSigner = overrides?.mintSigner ?? true;
  const includeCreate = overrides?.includeCreate ?? true;
  const style = overrides?.accountKeyStyle ?? "objects";
  const createData = new Uint8Array([...CREATE_V2_DISCRIMINATOR, 1, 2, 3, 4]);
  const buyData = new Uint8Array([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);
  const keys: Array<{ pubkey: string; signer: boolean; writable: boolean }> = [
    { pubkey: PAYER, signer: true, writable: true },
    { pubkey: MINT, signer: mintSigner, writable: true },
    { pubkey: BC, signer: false, writable: true },
    { pubkey: PUMP, signer: false, writable: false },
    { pubkey: COMPUTE, signer: false, writable: false },
  ];
  const accountKeys = style === "objects" ? keys : keys.map((k) => k.pubkey);
  const instructions: Array<Record<string, unknown>> = [];
  if (includeCreate) {
    instructions.push({
      programId: PUMP,
      data: encodeBase58(createData),
      accounts:
        overrides?.createIxAccountsIncludeMint === false
          ? [PAYER, BC]
          : [PAYER, MINT, BC],
    });
  }
  instructions.push({
    programId: ATA,
    data: encodeBase58(new Uint8Array([1])),
    accounts: [PAYER],
  });
  instructions.push({
    programId: PUMP,
    data: encodeBase58(buyData),
    accounts: [PAYER, MINT, BC],
  });
  instructions.push({
    programId: COMPUTE,
    data: encodeBase58(new Uint8Array([2])),
    accounts: [],
  });
  // Legacy-style plain-string key lists carry signer info in the message header.
  const header = style === "strings" ? { numRequiredSignatures: 2 } : undefined;
  const message: Record<string, unknown> = { accountKeys, instructions };
  if (header) message.header = header;
  return {
    meta: { err: overrides?.txErr ?? null },
    transaction: { message },
  };
}

describe("tx-inspect: parsedTxIsSpawnCreate", () => {
  it("accepts the REAL captured mainnet create transaction (end-to-end)", () => {
    const check = parsedTxIsSpawnCreate(realCreateTx(), MINT);
    expect(check.isCreate).to.equal(true, JSON.stringify(check));
    expect(check.mintIsSigner).to.equal(true);
    expect(check.pumpInstructionNames).to.include("create_v2");
  });

  it("accepts the synthetic v0 create+buy transaction shape (mint co-signs)", () => {
    const check = parsedTxIsSpawnCreate(buildParsedTx(), MINT);
    expect(check.isCreate).to.equal(true);
    expect(check.mintIsSigner).to.equal(true);
    expect(check.pumpInstructionNames).to.include("create_v2");
    expect(check.pumpInstructionNames).to.include("pump:66063d1201daebea");
  });

  it("accepts legacy plain-string account keys with a signature header", () => {
    const check = parsedTxIsSpawnCreate(buildParsedTx({ accountKeyStyle: "strings" }), MINT);
    expect(check.isCreate).to.equal(true);
    expect(check.mintIsSigner).to.equal(true);
  });

  it("rejects a transaction without a create instruction (buy-only)", () => {
    const check = parsedTxIsSpawnCreate(buildParsedTx({ includeCreate: false }), MINT);
    expect(check.isCreate).to.equal(false);
    expect(check.reason).to.contain("no create");
  });

  it("rejects when the mint did not co-sign (not a SpawnPad vanity launch)", () => {
    const check = parsedTxIsSpawnCreate(buildParsedTx({ mintSigner: false }), MINT);
    expect(check.isCreate).to.equal(false);
    expect(check.reason).to.contain("co-sign");
  });

  it("rejects when the create instruction does not reference the mint", () => {
    const check = parsedTxIsSpawnCreate(
      buildParsedTx({ createIxAccountsIncludeMint: false }),
      MINT
    );
    expect(check.isCreate).to.equal(false);
    expect(check.reason).to.contain("does not reference the claimed mint");
  });

  it("rejects a failed on-chain transaction", () => {
    const check = parsedTxIsSpawnCreate(
      buildParsedTx({ txErr: { InstructionError: [0, 0] } }),
      MINT
    );
    expect(check.isCreate).to.equal(false);
    expect(check.reason).to.contain("failed on-chain");
  });

  it("rejects empty/unavailable transactions", () => {
    expect(parsedTxIsSpawnCreate(null, MINT).isCreate).to.equal(false);
    expect(parsedTxIsSpawnCreate({}, MINT).isCreate).to.equal(false);
  });
});

describe("tx-inspect: extractPumpInstructions + key helpers", () => {
  it("resolves programIdIndex through the flattened key list (v0 style)", () => {
    const message = {
      accountKeys: [PAYER, MINT, PUMP, COMPUTE],
      instructions: [
        { programIdIndex: 3, data: encodeBase58(new Uint8Array([2])), accounts: [] },
        {
          programIdIndex: 2,
          data: encodeBase58(new Uint8Array([...CREATE_V2_DISCRIMINATOR])),
          accounts: [0, 1],
        },
      ],
    };
    const ixns = extractPumpInstructions(message);
    expect(ixns.length).to.equal(1);
    expect(ixns[0].name).to.equal("create_v2");
    expect(ixns[0].accounts).to.deep.equal([PAYER, MINT]);
    expect(flatParsedAccountKeys(message)).to.deep.equal([PAYER, MINT, PUMP, COMPUTE]);
  });

  it("reports signer flags from parsed account metas", () => {
    const metas = parsedAccountMetas(
      (buildParsedTx().transaction as { message: unknown }).message
    );
    expect(metas[1]).to.deep.equal({ pubkey: MINT, signer: true, writable: true });
    expect(metas[3].signer).to.equal(false);
  });

  it("never throws on malformed messages", () => {
    expect(extractPumpInstructions(undefined).length).to.equal(0);
    expect(extractPumpInstructions({ instructions: "nope" }).length).to.equal(0);
    expect(flatParsedAccountKeys("junk").length).to.equal(0);
  });
});