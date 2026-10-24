// Safely report which env vars exist in web/.env.local WITHOUT printing values.
// Non-secret values (network, gateway, app url) are printed in full.
const fs = require("fs");
const base = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const LOG = base + "/env-check.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const NON_SECRET = new Set([
  "NEXT_PUBLIC_NETWORK",
  "PINATA_GATEWAY",
  "NEXT_PUBLIC_APP_URL",
  "SOLANA_RPC_URL",
  "SOLANA_WS_URL",
]);

const files = [base + "/web/.env.local", base + "/web/.env.example"];
for (const p of files) {
  append(`=== ${p} ===`);
  append(`exists: ${fs.existsSync(p)}`);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (NON_SECRET.has(name)) {
      append(`${name} = ${value}`);
      continue;
    }
    const desc = {
      set: value.length > 0,
      isPlaceholder: /PASTE_|CHANGEME|REPLACE_ME|YOUR_|EXAMPLE/i.test(value),
      looksLikeJwt: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(value),
      hasWhitespace: /\s/.test(value),
    };
    append(`${name} = <<value not printed>> ${JSON.stringify(desc)}`);
  }
}
append("ENV-CHECK-DONE");
