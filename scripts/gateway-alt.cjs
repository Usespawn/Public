// Verify the smoke-test CIDs are publicly resolvable via an ALTERNATIVE
// public gateway (ipfs.io returned HTTP 429 rate-limit). One-shot, no retries.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/gateway-alt.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const IMAGE_CID = "bafkreigectgq4icn5f2pon2ty7ri25ry46zwsg5ywgrlvnvslo375v6oo4";
const META_CID = "bafkreidga3g5tnvopyijkvamwevai3np324wdkgpgwtcdlq5hgjyjdfmzi";
const GATEWAYS = ["https://gateway.pinata.cloud", "https://cloudflare-ipfs.com"];

async function main() {
  for (const gw of GATEWAYS) {
    for (const [label, cid] of [["image", IMAGE_CID], ["metadata", META_CID]]) {
      const url = `${gw}/ipfs/${cid}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        const ct = res.headers.get("content-type") || "(none)";
        const bytes = (await res.arrayBuffer()).byteLength;
        append(`${gw} ${label}: HTTP ${res.status} content-type=${ct} bytes=${bytes}`);
      } catch (e) {
        append(`${gw} ${label}: FETCH-FAILED ${e.message || e}`);
      }
    }
  }
  append("GATEWAY-ALT-DONE");
}
main();