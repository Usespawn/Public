// Broad scan: negative offsets, 100vw, oversized fixed widths, negative margins.
const fs = require("fs");
const path = require("path");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/offset-scan.txt";
const ROOT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const NEEDLES = [
  /-left-\[|left-\[-/,
  /-right-\[|right-\[-/,
  /-top-\[|top-\[-/,
  /-ml-|-mr-|-translate-x-1\/2/,
  /100vw|100%vw/,
  /w-\[\d{3,}px\]|min-w-\[\d{3,}px\]|text-\[\d{3,}px\]/,
  /text-\[\d+rem\]/,
];
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.next|\.data/.test(p)) walk(p); continue; }
    if (!/\.(tsx|ts|css)$/.test(e.name)) continue;
    let src;
    try { src = fs.readFileSync(p, "utf8"); } catch { continue; }
    const rel = path.relative(ROOT, p);
    src.split("\n").forEach((line, i) => {
      if (NEEDLES.some((re) => re.test(line))) {
        append(`${rel}:${i + 1}: ${line.trim().slice(0, 170)}`);
      }
    });
  }
}
walk(path.join(ROOT, "components"));
walk(path.join(ROOT, "app"));
walk(ROOT);
append("OFFSET-SCAN-DONE");