// Finds which packages pull a given dependency.
const fs = require("fs");
const text = fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/Cargo.lock", "utf8");
const blocks = text.split("[[package]]");
const needle = process.argv[2] || "getrandom 0.4";
const out = [];
for (const b of blocks) {
  const n = (b.match(/name = "([^"]+)"/) || [])[1];
  const v = (b.match(/version = "([^"]+)"/) || [])[1];
  if (!n) continue;
  if (b.includes('"' + needle + '"')) out.push("PULLER: " + n + " " + v);
}
out.push("---");
const re = new RegExp('name = "' + needle.split(" ")[0] + '"[\\s\\S]{0,80}version = "([^"]+)"', "g");
let m;
while ((m = re.exec(text))) out.push("VERSION: " + m[1]);
fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/lock-state.txt", out.join("\n") || "none");
