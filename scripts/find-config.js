const fs = require("fs");
const path = require("path");
const root = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.name === "node_modules" || e.name === ".next") continue;
    if (e.isDirectory()) walk(full);
    else if (/^(tailwind|postcss)\.config\./.test(e.name)) console.log(full);
  }
}
walk(root);