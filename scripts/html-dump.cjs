const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/html-head.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const src = fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/marketing/spawnpad-x-campaign/_render/banners.html", "utf8").split("\n");
src.slice(55, 75).forEach((l, i) => append(String(i + 56).padStart(3) + "| " + l.slice(0, 120)));
append("HEAD-DUMP-DONE");