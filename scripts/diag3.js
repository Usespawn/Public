/** Find compiled createElement("i")/jsx("i") in wallet-adapter-react-ui. */
const fs = require("fs");
const path = require("path");
const out = [];
const BASE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/@solana/wallet-adapter-react-ui";

function walk(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (/\.(js|mjs|cjs)$/.test(e.name)) files.push(p);
  }
  return files;
}

const RE = /(createElement|jsx|jsxs)\(\s*"i"|from\s+"react"\)\.jsx\("i"/;
for (const f of walk(BASE)) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((l, i) => {
    if (/"i"/.test(l) && (l.includes("createElement") || l.includes("jsx"))) {
      out.push(`${f.replace(BASE, "")}:${i + 1}: ${l.trim().slice(0, 200)}`);
    }
  });
}
out.push("SCAN2-END");
fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/diag3.log", out.join("\n"));
console.log("DIAG3-DONE");
