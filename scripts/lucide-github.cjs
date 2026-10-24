// Does the installed lucide-react export a Github icon?
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/lucide-github.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const BASE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/lucide-react";
const pkg = JSON.parse(fs.readFileSync(BASE + "/package.json", "utf8"));
append("lucide-react version: " + pkg.version);
const candidates = [
  BASE + "/dist/lucide-react.d.ts",
  BASE + "/dist/lucide-react.d.mts",
];
for (const f of candidates) {
  if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, "utf8");
  const names = [...src.matchAll(/declare const (Github[A-Za-z]*|BrandGithub[A-Za-z]*)\b/g)].map((m) => m[1]);
  append(f.slice(-28) + " -> " + (names.length ? names.join(", ") : "NO Github export"));
}
append("LUCIDE-GITHUB-DONE");