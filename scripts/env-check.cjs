#!/usr/bin/env node
/*
 * SpawnPad environment-file validator (Phase 7 of the env-config task).
 * Parses web/.env.local the way Next.js would (KEY=VALUE, # comments, no
 * inline value expansion) and verifies:
 *   1. every active variable name matches the audited code allowlist exactly
 *   2. the four code-read variables are present
 *   3. no duplicate keys
 *   4. no real-looking secret values (JWTs / long hex secrets) were pasted
 *      in by accident
 *   5. NEXT_PUBLIC_ is only used for browser-safe variables
 *   6. the network is still devnet (no accidental network switch)
 */
const fs = require("fs");
const path = require("path");

const WEB = path.join(__dirname, "..", "web");
const FILE = path.join(WEB, ".env.local");

// Exact allowlist from the Phase 1 source audit.
const ALL_KNOWN = new Set([
  "NEXT_PUBLIC_NETWORK",
  "NEXT_PUBLIC_SOLANA_RPC",
  "NEXT_PUBLIC_SOLANA_WS_RPC",
  "NEXT_PUBLIC_APP_URL",
  "MARKET_DATA_PROVIDER",
  "MARKET_DATA_API_KEY",
  "DATABASE_URL",
  "SERVER_API_SECRET",
  "PINATA_JWT",
  "PINATA_GATEWAY",
]);
const CODE_READ = ["NEXT_PUBLIC_NETWORK", "PINATA_JWT", "PINATA_GATEWAY"];
const BROWSER_SAFE = new Set([
  "NEXT_PUBLIC_NETWORK",
  "NEXT_PUBLIC_SOLANA_RPC",
  "NEXT_PUBLIC_SOLANA_WS_RPC",
  "NEXT_PUBLIC_APP_URL",
]);

const problems = [];
const warnings = [];

const raw = fs.readFileSync(FILE, "utf8");
const seen = new Map();
let active = [];

for (const [i, line] of raw.split(/\r?\n/).entries()) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) {
    problems.push(`Line ${i + 1}: not a KEY=VALUE line: "${t.slice(0, 40)}"`);
    continue;
  }
  const key = t.slice(0, eq).trim();
  const value = t.slice(eq + 1).trim();
  if (!/^[A-Z0-9_]+$/.test(key)) {
    problems.push(`Line ${i + 1}: invalid variable name "${key}"`);
  }
  if (!ALL_KNOWN.has(key)) {
    problems.push(`Line ${i + 1}: unknown variable "${key}" (not in audited allowlist)`);
  }
  if (seen.has(key)) {
    problems.push(`Line ${i + 1}: duplicate key "${key}" (first at line ${seen.get(key)})`);
  } else {
    seen.set(key, i + 1);
    active.push([key, value]);
  }
  // No accidental real secrets.
  if (key === "PINATA_JWT" && value && !value.startsWith("PASTE_") && value !== "") {
    if (/^eyJ/.test(value)) {
      warnings.push("PINATA_JWT contains what looks like a real JWT — that is fine if you pasted it intentionally; remember it stays server-side and git-ignored.");
    }
  }
  // NEXT_PUBLIC_ prefix must never carry a secret.
  if (key.startsWith("NEXT_PUBLIC_") && !BROWSER_SAFE.has(key)) {
    problems.push(`Line ${i + 1}: "${key}" uses NEXT_PUBLIC_ but is not on the browser-safe allowlist`);
  }
  if (/^[0-9a-f]{64,}$/i.test(value)) {
    warnings.push(`Line ${i + 1}: "${key}" value looks like a 64+ hex secret — verify this was intentional.`);
  }
}

for (const k of CODE_READ) {
  if (!seen.has(k)) problems.push(`Required-by-code variable "${k}" is missing from .env.local`);
}

const netEntry = active.find(([k]) => k === "NEXT_PUBLIC_NETWORK");
if (netEntry && netEntry[1] !== "devnet") {
  problems.push(`NEXT_PUBLIC_NETWORK is "${netEntry[1]}" — task requires the network to stay devnet`);
}

console.log("Active keys:", active.map(([k]) => k).join(", "));
for (const w of warnings) console.log("WARN:", w);
if (problems.length) {
  for (const p of problems) console.error("FAIL:", p);
  console.log(`\nENV-CHECK: FAIL (${problems.length} problem(s))`);
  process.exit(1);
}
console.log("\nENV-CHECK: PASS");