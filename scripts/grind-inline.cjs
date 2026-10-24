// Standalone in-process vanity grinder (debug + one-shot vanity address).
const path = require("path");
const fs = require("fs");
const root = path.resolve(__dirname, "..");
fs.writeFileSync(path.join(root, "grind-started.txt"), "STARTED " + new Date().toISOString());
let Keypair;
try {
  ({ Keypair } = require(path.join(root, "node_modules/@solana/web3.js")));
} catch (e) {
  fs.writeFileSync(path.join(root, "vanity-inline.json"), "REQUIRE_FAIL: " + e.message);
  process.exit(1);
}

const out = path.join(root, "vanity-inline.json");
const t0 = Date.now();
let attempts = 0;
try {
  while (true) {
    const kp = Keypair.generate();
    attempts++;
    const pk = kp.publicKey.toBase58();
    if (pk.endsWith("Spw")) {
      fs.writeFileSync(
        out,
        JSON.stringify({ publicKey: pk, secretKey: Array.from(kp.secretKey), attempts, ms: Date.now() - t0 })
      );
      process.exit(0);
    }
    if (attempts % 50000 === 0) {
      fs.writeFileSync(out, "progress " + attempts + " @" + (Date.now() - t0) + "ms");
    }
  }
} catch (e) {
  fs.writeFileSync(out, "ERROR: " + e.message + " attempts=" + attempts);
  process.exit(1);
}
