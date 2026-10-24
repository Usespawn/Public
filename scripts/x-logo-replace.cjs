// Replace <X /> icon usages with <XLogo /> in web/components/landing/Nav.tsx.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/x-logo-replace.log";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const FILE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/components/landing/Nav.tsx";
let src = fs.readFileSync(FILE, "utf8");

// Any <X className="..."> (with optional children, e.g. <X className="..." />) -> <XLogo ... />
const before = (src.match(/<X\b/g) || []).length;
src = src.replace(/<X\s+className=("[^"]*")\s*\/>/g, "<XLogo className=$1 />");
const after = (src.match(/<X\b/g) || []).length;
const xlogos = (src.match(/<XLogo\b/g) || []).length;

append(`X usages before: ${before}`);
append(`X usages after: ${after}`);
append(`XLogo usages: ${xlogos}`);

// Safety: report any remaining <X that was NOT replaced (unexpected pattern).
const leftover = [];
src.split("\n").forEach((line, i) => {
  if (/<X\b/.test(line)) leftover.push(`${i + 1}: ${line.trim().slice(0, 120)}`);
});
append("leftover raw <X lines:");
append(leftover.length ? leftover.join("\n") : "(none)");

fs.writeFileSync(FILE, src);
append("REPLACE-DONE");