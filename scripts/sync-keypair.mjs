#!/usr/bin/env node
/**
 * Syncs the deterministic Spawnpad program keypair (keypairs/program.json)
 * into target/deploy/ so `anchor deploy` signs for the declared program ID.
 *
 * Flow: npm run build:program && npm run sync:keypair && npm run test:program
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "keypairs", "program.json");
const dst = path.join(root, "target", "deploy", "spawnpad_engine-keypair.json");

if (!fs.existsSync(src)) {
  console.error(
    "Missing keypairs/program.json — generate it with:\n" +
      "  solana-keygen new --no-bip39-passphrase -o keypairs/program.json"
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log("Synced program keypair →", dst);
