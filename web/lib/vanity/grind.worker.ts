/// <reference lib="webworker" />
/**
 * Vanity mint grinding worker.
 *
 * Generates Ed25519 keypairs with Node-independent WebCrypto CSPRNG via
 * @solana/web3.js Keypair.generate(), tests each public key against the
 * exact case-sensitive suffix, and posts progress/result messages.
 *
 * Secret keys are posted ONLY to the spawning page (in-memory), never to any
 * server, log, or storage.
 */
import { Keypair } from "@solana/web3.js";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PROGRESS_EVERY = 512;

interface StartMessage {
  type: "start";
  suffix: string;
  prefix?: string;
  threads?: never; // one worker = one lane
  maxAttempts?: number;
}

export type WorkerRequest = StartMessage;

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  if (ev.data.type !== "start") return;
  const { suffix, prefix = "", maxAttempts } = ev.data;

  const base58Re = /^[1-9A-HJ-NP-Za-km-z]*$/;
  if (suffix && !base58Re.test(suffix)) {
    (self as unknown as Worker).postMessage({ type: "error", error: `suffix contains non-Base58 character` });
    return;
  }

  const start = Date.now();
  let attempts = 0;
  try {
    for (;;) {
      const keypair = Keypair.generate();
      const address = keypair.publicKey.toBase58();
      attempts++;

      if (
        (!suffix || address.endsWith(suffix)) &&
        (!prefix || address.startsWith(prefix))
      ) {
        (self as unknown as Worker).postMessage({
          type: "found",
          address,
          // Transfer as plain number[]: kept in memory on the page only.
          secretKey: Array.from(keypair.secretKey),
          attempts,
          elapsedMs: Date.now() - start,
        });
        return;
      }

      if (maxAttempts && attempts >= maxAttempts) {
        (self as unknown as Worker).postMessage({ type: "exhausted", attempts });
        return;
      }

      if (attempts % PROGRESS_EVERY === 0) {
        const elapsedMs = Date.now() - start;
        (self as unknown as Worker).postMessage({
          type: "progress",
          attempts,
          elapsedMs,
          attemptsPerSecond: Math.round((attempts / Math.max(1, elapsedMs)) * 1000),
        });
      }
    }
  } catch (e: any) {
    (self as unknown as Worker).postMessage({ type: "error", error: String(e?.message || e) });
  }
};
