/**
 * Browser-side vanity mint engine controller.
 *
 * Spawns a bounded pool of Web Workers, aggregates progress, supports
 * cancellation, and terminates all workers on cancel/success/failure.
 * The resulting keypair lives only in the calling page's memory.
 */
import { Keypair } from "@solana/web3.js";
import { MANDATORY_SUFFIX } from "@/lib/config";
import { isSpawnVanityAddress } from "@/lib/config";

export interface GrindProgress {
  attempts: number;
  attemptsPerSecond: number;
  elapsedMs: number;
  workersActive: number;
}

export interface GrindResult {
  mint: Keypair;
  address: string;
  attempts: number;
  elapsedMs: number;
  attemptsPerSecond: number;
}

export class GrindCancelledError extends Error {
  constructor() {
    super("vanity generation cancelled");
  }
}

export class GrindExhaustedError extends Error {
  constructor(public readonly attempts: number) {
    super(`vanity generation exhausted ${attempts} attempts`);
  }
}

/** 58^3 ≈ 195,112 expected attempts for the 3-char Spw suffix. */
export function expectedAttempts(suffix: string): number {
  return Math.pow(58, suffix.length);
}

/**
 * Conservative automatic worker count for hands-off generation:
 * half the logical cores, bounded to [2, 4]. Keeps phones responsive and
 * never saturates a desktop. Never exposed as a user setting.
 */
export function autoWorkerCount(hardwareConcurrency?: number): number {
  const hc =
    typeof hardwareConcurrency === "number" && Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0
      ? hardwareConcurrency
      : 4;
  return Math.max(2, Math.min(4, Math.floor(hc / 2)));
}


const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export class VanityGrinder {
  #workers: Worker[] = [];
  #cancelled = false;
  #done = false;

  get busy() {
    return this.#workers.length > 0 && !this.#done;
  }

  /** Default worker count: conservative (2) to avoid freezing user devices. */
  async grind(options: {
    suffix?: string;
    workerCount?: number;
    maxAttempts?: number;
    onProgress?: (p: GrindProgress) => void;
  }): Promise<GrindResult> {
    if (this.busy) throw new Error("grinder already running");
    const suffix = options.suffix ?? MANDATORY_SUFFIX;
    if (!suffix || [...suffix].some((c) => !BASE58.includes(c))) {
      throw new Error(`suffix '${suffix}' contains non-Base58 characters`);
    }
    if (suffix.length + (options.maxAttempts ? 0 : 0) > 7) {
      throw new Error("pattern too long (max 7 chars)");
    }
    const workerCount = Math.max(1, Math.min(options.workerCount ?? 2, 8));
    const maxAttempts = options.maxAttempts ?? 500_000_000;
    this.#cancelled = false;
    this.#done = false;

    const startedAt = Date.now();
    const lastByWorker = new Array<number>(workerCount).fill(0);

    const totalAttempts = () => lastByWorker.reduce((a, b) => a + b, 0);

    return new Promise<GrindResult>((resolve, reject) => {
      const settle = (fn: () => void) => {
        if (this.#done) return;
        this.#done = true;
        this.terminate();
        fn();
      };

      let exhaustedCount = 0;
      for (let i = 0; i < workerCount; i++) {
        // webpack 5 bundles this module reference for the browser.
        const w = new Worker(
          new URL("./grind.worker.ts", import.meta.url),
          { type: "module" }
        );
        this.#workers.push(w);

        w.onmessage = (ev: MessageEvent) => {
          const msg = ev.data;
          if (this.#done) return;
          if (msg.type === "progress") {
            lastByWorker[i] = msg.attempts;
            options.onProgress?.({
              attempts: totalAttempts(),
              attemptsPerSecond: msg.attemptsPerSecond,
              elapsedMs: Date.now() - startedAt,
              workersActive: workerCount,
            });
          } else if (msg.type === "found") {
            const address = msg.address as string;
            // Re-verify independently — never trust worker output blindly.
            if (!isSpawnVanityAddress(address)) {
              settle(() => reject(new Error(`worker returned invalid address ${address}`)));
              return;
            }
            const mint = Keypair.fromSecretKey(new Uint8Array(msg.secretKey));
            // Keypair consistency check: derived key must equal reported one.
            if (mint.publicKey.toBase58() !== address) {
              settle(() => reject(new Error("keypair/public-key mismatch from worker")));
              return;
            }
            const elapsedMs = Date.now() - startedAt;
            settle(() =>
              resolve({
                mint,
                address,
                attempts: totalAttempts(),
                elapsedMs,
                attemptsPerSecond: Math.round((totalAttempts() / Math.max(1, elapsedMs)) * 1000),
              })
            );
          } else if (msg.type === "exhausted") {
            lastByWorker[i] = msg.attempts;
            exhaustedCount++;
            if (exhaustedCount === workerCount) {
              settle(() => reject(new GrindExhaustedError(totalAttempts())));
            }
          } else if (msg.type === "error") {
            settle(() => reject(new Error(String(msg.error))));
          }
        };

        w.onerror = (e) => {
          settle(() => reject(new Error(`vanity worker crashed: ${e.message || e}`)));
        };

        w.postMessage({ type: "start", suffix, maxAttempts: maxAttempts ? Math.ceil(maxAttempts / workerCount) : undefined });
      }
    });
  }

  cancel() {
    this.#cancelled = true;
    this.terminate();
    this.#done = true;
  }

  /** Memory-safe worker lifecycle cleanup. */
  terminate() {
    for (const w of this.#workers) {
      try {
        w.terminate();
      } catch {
        /* already gone */
      }
    }
    this.#workers = [];
  }
}
