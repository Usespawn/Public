const https = require("https");
const fs = require("fs");
const url = "https://raw.githubusercontent.com/anza-xyz/agave/c027cfc3e09a7e3e44af07c680a581f8ac4d2ced/sdk/cargo-build-sbf/src/main.rs";
https.get(url, (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    const lines = d.split("\n");
    // find link_solana_toolchain function
    let start = -1;
    lines.forEach((l, i) => { if (l.includes("fn link_solana_toolchain")) start = i; });
    const range = lines.slice(Math.max(0, start), Math.min(lines.length, start + 60))
      .map((l, i) => (Math.max(0, start) + i + 1) + ": " + l);
    fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/agave-extract4.txt", range.join("\n"));
  });
}).on("error", (e) => {
  fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/agave-extract4.txt", "FETCH ERR: " + e.message);
});
