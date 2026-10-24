// Masked RPC endpoint-shape check — verifies the endpoint is configured,
// https, and Alchemy-hosted WITHOUT printing the URL or key.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/endpoint-check.txt";
const ENV = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/.env.local";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const vars = {};
for (const raw of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq < 0) continue;
  vars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

const rpc = vars.NEXT_PUBLIC_SOLANA_RPC || "";
append(`NEXT_PUBLIC_NETWORK = ${vars.NEXT_PUBLIC_NETWORK || "(unset)"}`);
append(`NEXT_PUBLIC_SOLANA_RPC set: ${rpc ? "YES" : "NO"}`);
if (!rpc) {
  append("ENDPOINT-CHECK: NOT CONFIGURED");
  process.exit(0);
}
try {
  const url = new URL(rpc);
  append(`protocol: ${url.protocol} (https required: ${url.protocol === "https:" ? "OK" : "FAIL"})`);
  append(`hostname: ${url.hostname}`);
  append(`isAlchemy host: ${/alchemy\./i.test(url.hostname) ? "YES" : "NO"}`);
  append(`isAlchemy mainnet path shape: ${/solana-mainnet/.test(url.pathname) ? "YES" : "NO"}`);
  append(`credential present: ${url.search || /\/v2\/|\/v3\/|api-key|token/i.test(url.pathname) ? "YES (redacted — never printed)" : "NO"}`);
  const keySegs = url.pathname.split("/").filter((s) => s.length >= 20 && /^[A-Za-z0-9_-]+$/.test(s));
  append(`key-like path segments redacted: ${keySegs.length}`);
  append(`placeholder value: ${/PASTE_|YOUR_|REPLACE|EXAMPLE|<your/i.test(rpc) ? "YES — FAIL" : "NO"}`);
  append("ENDPOINT-CHECK-DONE");
} catch {
  append("ENDPOINT MALFORMED — cannot parse as URL (value not printed)");
  append("ENDPOINT-CHECK: FAIL");
}