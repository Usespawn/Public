/**
 * Pure transaction-inspection helpers for server-side launch verification.
 *
 * ZERO imports — this module is unit-tested directly from the root ts-mocha
 * suite (tests/web/tx-inspect.test.ts) without path aliases or a bundler.
 *
 * Why this exists: pump.fun SDK (v4) launch transactions are VERSIONED (v0).
 * In that format `message.instructions[]` entries carry `programIdIndex` (an
 * index into the account-key list) — there is NO `programId` field. The
 * previous verification code assumed legacy `ix.programId.toBase58()` and
 * threw a TypeError on every v0 launch, crashing POST /api/launches with a
 * 500 before anything could be persisted. These helpers normalize both
 * formats defensively.
 *
 * Instruction data encoding differs too: legacy instructions expose
 * `data` as a byte array while v0 (and jsonParsed responses) expose it as a
 * BASE58 STRING. `decodeInstructionData` handles both.
 */

/** pump.fun bonding-curve program (official mainnet deployment). */
export const PUMP_PROGRAM_ID_58 = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

/** Anchor sighash("global:create_v2") — from the vendored @pump-fun/pump-sdk IDL. */
export const CREATE_V2_DISCRIMINATOR = new Uint8Array([
  0xd6, 0x90, 0x4c, 0xec, 0x5f, 0x8b, 0x31, 0xb4,
]);

/** Anchor sighash("global:create") — legacy create, also accepted. */
export const CREATE_DISCRIMINATOR = new Uint8Array([
  0x18, 0x1e, 0xc8, 0x28, 0x05, 0x1c, 0x07, 0x77,
]);

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP = new Map<string, number>(
  ALPHABET.split("").map((c, i) => [c, i])
);

/**
 * Decodes a base58 string (Bitcoin/Solana alphabet) into bytes.
 * Returns an empty array for non-string input or invalid characters.
 */
export function decodeBase58(input: unknown): Uint8Array {
  if (typeof input !== "string" || input.length === 0) return new Uint8Array(0);
  const bytes: number[] = [];
  for (const ch of input) {
    const value = ALPHABET_MAP.get(ch);
    if (value === undefined) return new Uint8Array(0);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1' characters encode leading zero bytes.
  for (const ch of input) {
    if (ch !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}
/**
 * Extracts the raw instruction bytes regardless of the response shape:
 * legacy `TransactionInstruction.data` is a byte array; v0 compiled and
 * jsonParsed instructions expose base58 strings.
 */
export function decodeInstructionData(data: unknown): Uint8Array {
  if (data == null) return new Uint8Array(0);
  if (typeof data === "string") return decodeBase58(data);
  if (data instanceof Uint8Array) return data;
  if (Array.isArray(data) && data.every((n) => typeof n === "number")) {
    return new Uint8Array(data as number[]);
  }
  return new Uint8Array(0);
}

/** Flattens parsed-message account keys into base58 strings.
 * web3.js may hand back PublicKey instances for `pubkey` fields even in
 * parsed responses (JSON.stringify hides this via its toJSON), so every
 * value is normalized through String(). */
export function flatParsedAccountKeys(message: unknown): string[] {
  if (message == null || typeof message !== "object") return [];
  const keys = (message as { accountKeys?: unknown }).accountKeys;
  if (!Array.isArray(keys)) return [];
  return keys
    .map((k: unknown) => {
      if (typeof k === "string") return k;
      if (k != null && typeof k === "object") {
        const pk = (k as { pubkey?: unknown }).pubkey;
        if (pk != null) return String(pk);
      }
      return String(k);
    })
    .filter((s) => s.length > 0);
}

export interface ParsedAccountMetaView {
  pubkey: string;
  signer: boolean;
  writable: boolean;
}

/** Extracts {pubkey, signer, writable} views from a parsed message.
 * Object-form keys (jsonParsed responses) carry explicit signer flags; for
 * legacy plain-string key lists the first `header.numRequiredSignatures`
 * keys are the signers. */
export function parsedAccountMetas(message: unknown): ParsedAccountMetaView[] {
  if (message == null || typeof message !== "object") return [];
  const keys = (message as { accountKeys?: unknown }).accountKeys;
  if (!Array.isArray(keys)) return [];
  const flat = flatParsedAccountKeys(message);
  const header = (message as { header?: { numRequiredSignatures?: unknown } }).header;
  const numRequiredSignatures =
    typeof header?.numRequiredSignatures === "number" ? header.numRequiredSignatures : 0;
  return keys.map((k: unknown, i: number) => {
    const pubkey = typeof k === "string" ? k : flat[i] ?? String(k);
    let signer = false;
    let writable = false;
    if (typeof k === "string") {
      signer = i < numRequiredSignatures;
      writable = i < numRequiredSignatures;
    } else if (k != null && typeof k === "object") {
      signer = (k as { signer?: unknown }).signer === true;
      writable = (k as { writable?: unknown }).writable === true;
    }
    return { pubkey: pubkey ?? "", signer, writable };
  });
}

export interface PumpInstructionView {
  /** Instruction name when recognized, otherwise `pump:<first8 hex>`. */
  name: string;
  data: Uint8Array;
  /** Account pubkeys referenced by the instruction (resolved). */
  accounts: string[];
}

/**
 * Collects pump-program instructions from a parsed transaction message,
 * resolving program ids through `programIdIndex` when needed and decoding
 * base58 instruction data.
 */
export function extractPumpInstructions(message: unknown): PumpInstructionView[] {
  if (message == null || typeof message !== "object") return [];
  const flat = flatParsedAccountKeys(message);
  const instructions = (message as { instructions?: unknown }).instructions;
  if (!Array.isArray(instructions)) return [];
  const out: PumpInstructionView[] = [];
  for (const ix of instructions) {
    if (ix == null || typeof ix !== "object") continue;
    const raw = ix as {
      programId?: unknown;
      programIdIndex?: unknown;
      data?: unknown;
      accounts?: unknown;
    };
    let pid: string;
    if (raw.programId != null) pid = String(raw.programId);
    else if (typeof raw.programIdIndex === "number") pid = flat[raw.programIdIndex] ?? "";
    else continue;
    if (pid !== PUMP_PROGRAM_ID_58) continue;
    const data = decodeInstructionData(raw.data);
    let name = "pump:" + Buffer.from(data.slice(0, 8)).toString("hex");
    if (matches(data, CREATE_V2_DISCRIMINATOR)) name = "create_v2";
    else if (matches(data, CREATE_DISCRIMINATOR)) name = "create";
    const accounts = Array.isArray(raw.accounts)
      ? raw.accounts.map((a) => {
          if (typeof a === "string") return a;
          if (a != null && typeof a === "object" && (a as { pubkey?: unknown }).pubkey != null) {
            return String((a as { pubkey?: unknown }).pubkey);
          }
          if (typeof a === "number") return flat[a] ?? "";
          return String(a);
        })
      : [];
    out.push({ name, data, accounts });
  }
  return out;
}

function matches(data: Uint8Array, discriminator: Uint8Array): boolean {
  if (data.length < discriminator.length) return false;
  for (let i = 0; i < discriminator.length; i++) {
    if (data[i] !== discriminator[i]) return false;
  }
  return true;
}

export interface SpawnCreateCheck {
  isCreate: boolean;
  /** Human-readable reason when isCreate is false (diagnostics only). */
  reason?: string;
  /** The create signature candidate's pump instruction names, for evidence. */
  pumpInstructionNames: string[];
  /** True when the claimed mint appears as a SIGNER (vanity keypair co-signs). */
  mintIsSigner: boolean;
  /** True when the claimed mint appears among the tx account keys at all. */
  mintPresent: boolean;
}

/**
 * Decides whether a parsed transaction is a SpawnPad-style pump.fun launch
 * of `mint`: a successful tx containing a pump create/create_v2 instruction
 * whose accounts include the mint, with the mint co-signing the transaction
 * (the ground vanity keypair always co-signs in SpawnPad's flow).
 */
export function parsedTxIsSpawnCreate(
  parsedTx: unknown,
  mint58: string
): SpawnCreateCheck {
  const fail = (reason: string, names: string[] = [], signer = false, present = false): SpawnCreateCheck =>
    ({ isCreate: false, reason, pumpInstructionNames: names, mintIsSigner: signer, mintPresent: present });
  if (parsedTx == null || typeof parsedTx !== "object") return fail("transaction unavailable");
  const meta = (parsedTx as { meta?: { err?: unknown } }).meta;
  if (meta?.err != null) return fail("transaction failed on-chain");
  const message = (parsedTx as { transaction?: { message?: unknown } }).transaction?.message;
  if (message == null) return fail("transaction message unavailable");
  const metas = parsedAccountMetas(message);
  const mintMeta = metas.find((m) => m.pubkey === mint58);
  const mintPresent = mintMeta != null;
  const mintIsSigner = mintMeta?.signer === true;
  const pumpIxns = extractPumpInstructions(message);
  const names = pumpIxns.map((i) => i.name);
  if (pumpIxns.length === 0) return fail("no official pump.fun program instruction", names, mintIsSigner, mintPresent);
  const create = pumpIxns.find((i) => i.name === "create_v2" || i.name === "create");
  if (!create) return fail("no create/create_v2 instruction", names, mintIsSigner, mintPresent);
  if (!mintPresent) return fail("claimed mint is not part of the launch transaction", names, mintIsSigner, mintPresent);
  if (!create.accounts.includes(mint58)) {
    return fail("create instruction does not reference the claimed mint", names, mintIsSigner, mintPresent);
  }
  if (!mintIsSigner) {
    return fail("claimed mint did not co-sign the create transaction (not a SpawnPad vanity launch)", names, mintIsSigner, mintPresent);
  }
  return { isCreate: true, pumpInstructionNames: names, mintIsSigner, mintPresent };
}