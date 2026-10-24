#!/usr/bin/env node
/**
 * spawn-grind — CLI for the Spawnpad vanity keypair grinder.
 *
 * Examples:
 *   spawn-grind                          # grind a ...Spw mint keypair
 *   spawn-grind -t 8                     # 8 worker threads
 *   spawn-grind --suffix Spw -o mint.json
 */
import fs from "node:fs";
import { parseArgs } from "node:util";
import { grindVanityKeypair, DEFAULT_SUFFIX, expectedAttempts } from "./grinder";

async function main() {
  const { values } = parseArgs({
    options: {
      suffix: { type: "string", default: DEFAULT_SUFFIX },
      prefix: { type: "string", default: "" },
      threads: { type: "string", short: "t" },
      out: { type: "string", short: "o" },
      count: { type: "string", short: "c", default: "1" },
      "case-insensitive": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
  });

  const suffix = values.suffix ?? DEFAULT_SUFFIX;
  const prefix = values.prefix ?? "";
  const caseInsensitive = values["case-insensitive"] ?? false;
  const threads = values.threads ? Number(values.threads) : undefined;
  const count = Math.max(1, Number(values.count ?? "1"));

  if (!values.json && !values.out) {
    console.log(
      `spawn-grind: mining ${count} keypair(s) with suffix "${suffix}"` +
        (prefix ? ` prefix "${prefix}"` : "") +
        (threads ? ` on ${threads} threads` : "") +
        ` (~${expectedAttempts(suffix.length, caseInsensitive).toLocaleString()} attempts expected)`
    );
  }

  for (let i = 0; i < count; i++) {
    const res = await grindVanityKeypair({
      suffix,
      prefix,
      caseInsensitive,
      threads,
      onProgress: values.json
        ? undefined
        : (p) =>
            process.stdout.write(
              `\r  attempts: ${p.attempts.toLocaleString()} | rate: ${p.ratePerSec.toLocaleString()}/s | elapsed: ${(p.elapsedMs / 1000).toFixed(1)}s`
            ),
    });
    if (!values.json && !values.out) process.stdout.write("\n");

    if (values.out) {
      const file =
        count > 1 ? values.out.replace(/(\.\w+)?$/, `-${i + 1}$1`) : values.out;
      fs.writeFileSync(file, JSON.stringify(Array.from(res.secretKey)));
    }

    if (values.json) {
      console.log(
        JSON.stringify({
          publicKey: res.publicKey,
          secretKey: Array.from(res.secretKey),
          attempts: res.attempts,
          elapsedMs: res.elapsedMs,
          ratePerSec: res.ratePerSec,
        })
      );
    } else {
      console.log(
        `  ✓ ${res.publicKey}\n` +
          `    ${res.attempts.toLocaleString()} attempts | ${res.ratePerSec.toLocaleString()}/s | ${(res.elapsedMs / 1000).toFixed(2)}s` +
          (values.out ? ` | saved → ${values.out}` : "")
      );
    }
  }
}

main().catch((err) => {
  console.error("spawn-grind failed:", err?.message ?? err);
  process.exit(1);
});
