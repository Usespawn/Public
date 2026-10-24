// Grep pump-sdk source for create_v2 construction details.
const fs = require("fs");
const path = require("path");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/sdk-scan.txt";
const ROOT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/@pump-fun/pump-sdk/src";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const NEEDLES = [
  /createV2/i,
  /mint_authority|mintAuthority/i,
  /freeze/i,
  /updateAuthority|update_authority/i,
  /metadata/i,
  /initializeMint|initialize_mint/i,
  /immutable/i,
];
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(ts|json)$/.test(e.name)) continue;
    let src;
    try { src = fs.readFileSync(p, "utf8"); } catch { continue; }
    const rel = path.relative(ROOT, p);
    src.split("\n").forEach((line, i) => {
      if (NEEDLES.some((re) => re.test(line))) {
        append(`${rel}:${i + 1}: ${line.trim().slice(0, 190)}`);
      }
    });
  }
}
walk(ROOT);
append("SDK-SCAN-DONE");