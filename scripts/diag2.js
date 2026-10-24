/** Find <i> renderers inside wallet-adapter-react-ui + react-ui-core. */
const fs = require("fs");
const path = require("path");
const out = [];
const BASE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/@solana";

function walk(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (/\.(js|mjs|cjs|es.js|ts)$/.test(e.name)) files.push(p);
  }
  return files;
}

for (const pkg of ["wallet-adapter-react-ui", "wallet-adapter-react-ui/lib/esm", "wallet-adapter-react-ui/lib/cjs", "wallet-adapter-base", "wallet-adapter-react"]) {
  const dir = path.join(BASE, pkg);
  for (const f of walk(dir)) {
    const src = fs.readFileSync(f, "utf8");
    if (/<i[\s>/]/.test(src)) {
      out.push("=== " + f.replace(BASE, "") + " ===");
      src.split("\n").forEach((l, i) => {
        if (/<i[\s>/]/.test(l)) out.push(`  ${i + 1}: ${l.trim().slice(0, 160)}`);
      });
    }
  }
}
out.push("SCAN-END");
fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/diag2.log", out.join("\n"));
console.log("DIAG2-DONE");
