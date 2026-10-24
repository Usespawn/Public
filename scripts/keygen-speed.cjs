// Time 200 Keypair.generate() calls (plain node) + read vanity-ground.json safely.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/keygen-speed.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

// Load web3.js from web/node_modules WITHOUT importing any TS.
const web3 = require("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/@solana/web3.js");
const Keypair = web3.Keypair;

const t0 = Date.now();
const N = 200;
for (let i = 0; i < N; i++) Keypair.generate();
const per = (Date.now() - t0) / N;
append(`keygen: ${per.toFixed(3)} ms/keygen over ${N} calls`);
append(`estimated 195112 attempts: ${((per * 195112) / 1000).toFixed(1)} s single-threaded`);

// Vanity ground result from an earlier session (print ONLY the address).
try {
  const g = JSON.parse(fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/vanity-ground.json", "utf8"));
  const keys = Object.keys(g);
  append(`vanity-ground.json keys: ${keys.join(", ")}`);
  const addr = g.address || g.mint || g.publicKey || (g.mint58 ?? null);
  append(`address field: ${addr ? String(addr) : "(none)"}`);
  append(`ends with Spw: ${addr && /Spw$/.test(String(addr))}`);
} catch (e) {
  append("vanity-ground.json: absent/unreadable - " + String(e?.message || e).slice(0, 80));
}
append("KEYGEN-CHECK-DONE");