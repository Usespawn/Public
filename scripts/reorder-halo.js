/** Move the core halo circle behind the S path in all emblem SVGs (CRLF-safe). */
const fs = require("fs");
const dir = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/brand/svg/";
const files = [
  "spawnpad-emblem-gradient.svg",
  "spawnpad-icon-tile.svg",
  "spawnpad-logo-dark.svg",
  "spawnpad-logo-light.svg",
  "spawnpad-emblem-mono.svg",
  "spawnpad-emblem-mono-white.svg",
];
const HALO_RE = /[\r\n]+\s*<circle cx="48" cy="48" r="10"[\s\S]*?\/>(?=[\r\n])/;
let done = 0;
for (const f of files) {
  let t = fs.readFileSync(dir + f, "utf8");
  const m = t.match(HALO_RE);
  if (!m) { console.log("NOMATCH", f); continue; }
  const halo = m[0].trim();
  t = t.replace(HALO_RE, "");
  const idx = t.indexOf('<path d="M58.4');
  if (idx < 0) { console.log("NO-S", f); continue; }
  t = t.slice(0, idx) + halo + "\n  " + t.slice(idx);
  fs.writeFileSync(dir + f, t);
  done++;
  console.log("reordered", f);
}
console.log("REORDER-DONE", done);
