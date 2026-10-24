// Fetches agave main.rs and prints specific line ranges.
const https = require("https");
const fs = require("fs");
const url = "https://raw.githubusercontent.com/anza-xyz/agave/c027cfc3e09a7e3e44af07c680a581f8ac4d2ced/sdk/cargo-build-sbf/src/main.rs";
https.get(url, (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    const lines = d.split("\n");
    const range = lines.slice(225, 420).map((l, i) => (i + 226) + ": " + l);
    fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/agave-extract2.txt", range.join("\n"));
  });
}).on("error", (e) => {
  fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/agave-extract2.txt", "FETCH ERR: " + e.message);
});
