// Verify which modules import the server-only Pinata client + list docs mentions.
const fs = require("fs");
const path = require("path");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/pinata-refs.txt";
const ROOT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";
const SKIP = /node_modules|\.next|\.git|dist|coverage/;
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".md"]);
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
(function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.test(p)) walk(p); continue; }
    if (!EXTS.has(path.extname(e.name))) continue;
    let src;
    try { src = fs.readFileSync(p, "utf8"); } catch { continue; }
    const rel = path.relative(ROOT, p);
    src.split("\n").forEach((line, i) => {
      if (/pinata|PINATA/i.test(line)) append(`${rel}:${i + 1}: ${line.trim().slice(0, 180)}`);
    });
  }
})(ROOT);
append("PINATA-REFS-DONE");