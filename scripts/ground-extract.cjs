// Extract the first complete ground result from vanity-ground.json.
// Prints ONLY the public address. Writes a sanitized handoff file with the
// secret key array for fee-check (temp file; content never printed).
const fs = require("fs");
const BASE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const LOG = BASE + "/ground-extract.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const raw = fs.readFileSync(BASE + "/vanity-ground.json", "utf8");
// Pull candidate JSON objects: { "address": "...", "secretKey": [...] , ... }
const addrMatches = [...raw.matchAll(/"(?:address|mint|mint58|publicKey)"\s*:\s*"([1-9A-HJ-NP-Za-km-z]{43,44})"/g)].map((m) => m[1]);
append(`address candidates found: ${addrMatches.length}`);
for (const a of addrMatches.slice(0, 5)) append(`  ${a}  endsWithSpw=${/Spw$/.test(a)}`);

// Find a secret-key array that follows an address ending in Spw.
const objRe = /"publicKey"\s*:\s*"([1-9A-HJ-NP-Za-km-z]{43,44})"[\s\S]{0,400}?"secretKey"\s*:\s*\[([\d,\s]{180,3400})\]/g;
let found = null;
for (const m of raw.matchAll(objRe)) {
  if (/Spw$/.test(m[1])) {
    const secret = m[2].split(",").map((s) => parseInt(s.trim(), 10));
    if (secret.length >= 64 && secret.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      found = { address: m[1], secret };
      break;
    }
  }
}
if (!found) {
  append("NO-VALID-GROUND-KEYPAIR (address ending Spw with secret)");
  process.exit(1);
}
append(`USING ground mint: ${found.address}`);
fs.writeFileSync(BASE + "/ground-handoff.json", JSON.stringify({ address: found.address, secretKey: found.secret }));
append("ground-handoff.json written (secret never printed)");
append("GROUND-EXTRACT-DONE");