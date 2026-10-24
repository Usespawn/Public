// Analyzes Cargo.lock: current state summary.
const fs = require("fs");
const text = fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/Cargo.lock", "utf8");
const m = text.match(/^version = (\d+)/m);
const blake3 = text.match(/name = "blake3"[\s\S]*?version = "([^"]+)"/);
fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/lock-state.txt",
  "lock version: " + (m ? m[1] : "?") + "\nblake3: " + (blake3 ? blake3[1] : "?"));
