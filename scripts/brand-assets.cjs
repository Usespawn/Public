// List web/public assets + extract brand palette/fonts/typography facts.
const fs = require("fs");
const path = require("path");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/brand-assets.txt";
const WEB = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

(function list(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { append("[dir] " + path.relative(WEB, p)); list(p); }
    else append(path.relative(WEB, p) + "  (" + fs.statSync(p).size + "B)");
  }
})(path.join(WEB, "public"));

// Palette from tailwind.config.ts
const tw = fs.readFileSync(path.join(WEB, "tailwind.config.ts"), "utf8");
append("\n=== tailwind colors ===");
for (const m of tw.matchAll(/(\w+[\w-]*):\s*"(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))"/g)) append(`  ${m[1]} = ${m[2]}`);
const fonts = tw.match(/fontFamily:\s*{[\s\S]*?}/);
append("=== fontFamily ===\n" + (fonts ? fonts[0] : "(none)"));

// Fonts from globals.css @font-face / families
const css = fs.readFileSync(path.join(WEB, "app", "globals.css"), "utf8");
append("=== globals.css font refs ===");
for (const m of css.matchAll(/font-family:[^;]+/g)) append("  " + m[0].trim().slice(0, 100));
append("=== @font-face/google imports ===");
for (const m of css.matchAll(/@font-face[\s\S]{0,180}?}/g)) append("  " + m[0].replace(/\s+/g, " ").slice(0, 160));
const google = css.match(/@import[^;]+googleapis[^;]+;/);
append("google import: " + (google ? google[0].slice(0, 160) : "(none)"));
append("BRAND-ASSETS-DONE");