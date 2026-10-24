//! @spawnpad/vanity-grinder — mines Solana keypairs whose Base58 address ends
//! in a vanity suffix (default `Spw`).
//!
//! Base58 is case-sensitive: an exact `Spw` suffix is hit with probability
//! 58^-3 ≈ 1/195,112 per keypair, i.e. ~195k attempts on average. A worker
//! pool over Node `worker_threads` reaches ~0.5–1.5M attempts/sec across cores,
//! so a fresh `...Spw` mint keypair is typically ground in well under a second.
//!
//! This is the Solana analogue of EVM CREATE2 salt grinding: instead of a salt,
//! we grind the Ed25519 keypair itself, and the resulting mint keypair signs
//! the `create_curve` transaction (the on-chain program additionally verifies
//! the `Spw` suffix, so a non-vanity mint can never be launched).

import { Keypair } from "@solana/web3.js";
import { Worker } from "node:worker_threads";
import os from "node:os";
import path from "node:path";

export const DEFAULT_SUFFIX = "Spw";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface VanityPattern {
  /** Address must end with this. Default: "Spw". Empty string disables. */
  suffix?: string;
  /** Address must start with this. Default: "" (disabled). */
  prefix?: string;
  /** Match suffix/prefix case-insensitively. Default: false. */
  caseInsensitive?: boolean;
}

export interface GrindOptions extends VanityPattern {
  /** Worker thread count. Default: number of CPU cores. */
  threads?: number;
  /** Hard cap on attempts (across all workers) before giving up. */
  maxAttempts?: number;
  /** Progress callback (~every 200ms per worker). */
  onProgress?: (progress: GrindProgress) => void;
  /** Cancellation signal. */
  signal?: AbortSignal;
}

export interface GrindProgress {
  attempts: number;
  elapsedMs: number;
  ratePerSec: number;
}

export interface GrindResult extends GrindProgress {
  /** Base58 public key — the vanity mint address (ends with the suffix). */
  publicKey: string;
  /** 64-byte Solana secret key (seed || public). */
  secretKey: Uint8Array;
  /** Reconstructed web3.js keypair. */
  keypair: Keypair;
}

/** True if every char of `s` is in the Base58 alphabet. */
export function isBase58(s: string): boolean {
  for (const c of s) {
    if (!BASE58_ALPHABET.includes(c)) return false;
  }
  return true;
}

/** Expected number of attempts to hit a suffix of the given length. */
export function expectedAttempts(length: number, caseInsensitive = false): number {
  const base = caseInsensitive ? 29 : 58; // 2 case variants per letter vs 1
  return Math.round(Math.pow(base, length));
}

/** Check a rendered Base58 address against a vanity pattern. */
export function vanityMatches(address: string, pattern: VanityPattern = {}): boolean {
  const { suffix = "", prefix = "", caseInsensitive = false } = pattern;
  if (!suffix && !prefix) return true;
  let a = address;
  let sfx = suffix;
  let pfx = prefix;
  if (caseInsensitive) {
    a = a.toLowerCase();
    sfx = sfx.toLowerCase();
    pfx = pfx.toLowerCase();
  }
  return (!sfx || a.endsWith(sfx)) && (!pfx || a.startsWith(pfx));
}

export function defaultThreads(): number {
  const cpus = os.cpus()?.length ?? 1;
  return Math.max(1, cpus);
}

/**
 * Worker loop, injected via `new Worker(source, { eval: true })` so the module
 * works identically from TS (tsx), CJS dist, and packaged CLIs without path
 * gymnastics. Resolves @solana/web3.js from the host module's directory.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const { createRequire } = require("node:module");
const req = createRequire(workerData.moduleBase);
const { Keypair } = req("@solana/web3.js");

const suffix = workerData.caseInsensitive ? workerData.suffix.toLowerCase() : workerData.suffix;
const prefix = workerData.caseInsensitive ? workerData.prefix.toLowerCase() : workerData.prefix;
const { maxAttempts, chunkSize } = workerData;
const norm = (s) => (workerData.caseInsensitive ? s.toLowerCase() : s);

let attempts = 0;
const start = Date.now();
let nextReport = start + 200;

function loop() {
  for (let i = 0; i < chunkSize; i++) {
    const kp = Keypair.generate();
    attempts++;
    const pk = norm(kp.publicKey.toBase58());
    if ((!suffix || pk.endsWith(suffix)) && (!prefix || pk.startsWith(prefix))) {
      parentPort.postMessage({
        found: true,
        publicKey: kp.publicKey.toBase58(),
        secretKey: kp.secretKey,
        attempts,
      });
      return;
    }
  }
  const now = Date.now();
  if (now >= nextReport) {
    parentPort.postMessage({ progress: { attempts, elapsedMs: now - start } });
    nextReport = now + 200;
  }
  if (maxAttempts && attempts >= maxAttempts) {
    parentPort.postMessage({ exhausted: true, attempts });
    return;
  }
  setImmediate(loop);
}
loop();
`;

/** Grind one keypair matching the vanity pattern. */
export async function grindVanityKeypair(options: GrindOptions = {}): Promise<GrindResult> {
  const {
    suffix = DEFAULT_SUFFIX,
    prefix = "",
    caseInsensitive = false,
    threads = defaultThreads(),
    maxAttempts,
    onProgress,
    signal,
  } = options;

  if (suffix && !isBase58(suffix)) {
    throw new Error(`suffix "${suffix}" contains non-base58 characters`);
  }
  if (prefix && !isBase58(prefix)) {
    throw new Error(`prefix "${prefix}" contains non-base58 characters`);
  }
  if (suffix.length + prefix.length > 7) {
    throw new Error(
      `pattern too long (${suffix.length + prefix.length} chars, max 7) — grinding would take too long`
    );
  }
  if (threads < 1) {
    throw new Error("threads must be >= 1");
  }

  const moduleBase = path.join(__dirname, "noop.js");
  const perWorkerMax = maxAttempts ? Math.ceil(maxAttempts / threads) : undefined;
  const startedAt = Date.now();
  const lastAttempts = new Array<number>(threads).fill(0);
  let exhaustedCount = 0;

  const totalAttempts = () => lastAttempts.reduce((a, b) => a + b, 0);

  const workers: Worker[] = [];
  const cleanup = () => {
    for (const w of workers) {
      w.removeAllListeners();
      void w.terminate();
    }
    workers.length = 0;
  };

  return new Promise<GrindResult>((resolve, reject) => {
    let settled = false;
    const fail = (e: unknown) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(e);
      }
    };
    const succeed = (result: GrindResult) => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(result);
      }
    };

    if (signal) {
      if (signal.aborted) {
        fail(new Error("grinding aborted"));
        return;
      }
      signal.addEventListener("abort", () => fail(new Error("grinding aborted")), { once: true });
    }

    for (let i = 0; i < threads; i++) {
      const w = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: { suffix, prefix, caseInsensitive, maxAttempts: perWorkerMax, moduleBase, chunkSize: 256 },
      });
      workers.push(w);

      w.on("message", (msg: any) => {
        if (msg.found) {
          lastAttempts[i] = msg.attempts;
          const attemptsTotal = totalAttempts();
          const elapsedMs = Math.max(1, Date.now() - startedAt);
          succeed({
            publicKey: msg.publicKey,
            secretKey: new Uint8Array(msg.secretKey),
            keypair: Keypair.fromSecretKey(Buffer.from(msg.secretKey)),
            attempts: attemptsTotal,
            elapsedMs,
            ratePerSec: Math.round(attemptsTotal / (elapsedMs / 1000)),
          });
        } else if (msg.progress) {
          lastAttempts[i] = msg.progress.attempts;
          const attemptsTotal = totalAttempts();
          const elapsedMs = Math.max(1, Date.now() - startedAt);
          onProgress?.({
            attempts: attemptsTotal,
            elapsedMs,
            ratePerSec: Math.round(attemptsTotal / (elapsedMs / 1000)),
          });
        } else if (msg.exhausted) {
          lastAttempts[i] = msg.attempts;
          exhaustedCount++;
          if (exhaustedCount === threads && !settled) {
            fail(
              new Error(
                `grinding exhausted maxAttempts=${maxAttempts} (${totalAttempts()} attempts)`
              )
            );
          }
        }
      });
      w.on("error", (e) => fail(e));
      w.on("exit", (code) => {
        if (code !== 0) fail(new Error(`grinder worker exited with code ${code}`));
      });
    }
  });
}

/** Grind `count` keypairs sequentially (each call re-spawns the worker pool). */
export async function grindVanityKeypairs(
  count: number,
  options: GrindOptions = {}
): Promise<GrindResult[]> {
  const results: GrindResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(await grindVanityKeypair(options));
  }
  return results;
}

/** Convenience: grind a Spawnpad mint keypair (address ends in `Spw`). */
export function generateSpawnKeypair(options: Omit<GrindOptions, "suffix"> = {}): Promise<GrindResult> {
  return grindVanityKeypair({ suffix: DEFAULT_SUFFIX, ...options });
}
