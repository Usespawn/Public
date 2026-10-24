// Extract the banners.html script and syntax-check it.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/banner-syntax.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const HTML = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/marketing/spawnpad-x-campaign/_render/banners.html";
const src = fs.readFileSync(HTML, "utf8");
const m = src.match(/<script>([\s\S]*)<\/script>/);
if (!m) { append("NO SCRIPT FOUND"); process.exit(1); }
const js = m[1];
append("script length: " + js.length);
try {
  new Function(js);
  append("SYNTAX OK");
} catch (e) {
  append("SYNTAX ERROR: " + String(e?.message || e).slice(0, 400));
  // locate approx line
  const lineMatch = e.stack.match(/<anonymous>:(\d+)/);
  if (lineMatch) {
    const ln = parseInt(lineMatch[1], 10) - 2; // Function wrapper offset
    append("near line " + ln + ": " + (js.split("\n")[ln - 1] || "").slice(0, 160));
  }
}
append("SYNTAX-CHECK-DONE");