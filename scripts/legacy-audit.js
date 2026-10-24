/** Final legacy-class audit across app+components. */
const fs = require("fs");
const path = require("path");
const ROOTS = [
  "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/app",
  "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/components",
];
const LEGACY = [
  "zinc-", "text-mint", "bg-mint", "border-mint", "bg-white", "text-white",
  "border-white", "amber-", "red-500", "text-red-", "text-black",
  "#080909", "#B9F65A", "#0B1020", "#27E0FF", "#806BFF", "#08080A",
];
function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const hits = [];
for (const f of ROOTS.flatMap(walk)) {
  const src = fs.readFileSync(f, "utf8");
  for (const l of LEGACY) {
    if (src.includes(l)) {
      const line = src.split("\n").findIndex((x) => x.includes(l)) + 1;
      hits.push(`${path.basename(f)}:${line} -> ${l}`);
    }
  }
}
fs.writeFileSync(
  "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/legacy-audit.log",
  hits.length ? hits.join("\n") : "CLEAN — no legacy classes found"
);
console.log("AUDIT-WRITTEN", hits.length);
