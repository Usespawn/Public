// Fetches agave main.rs and extracts the platform-tools install section.
const https = require("https");
const fs = require("fs");
const url = "https://raw.githubusercontent.com/anza-xyz/agave/c027cfc3e09a7e3e44af07c680a581f8ac4d2ced/sdk/cargo-build-sbf/src/main.rs";
https.get(url, (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    const lines = d.split("\n");
    const out = [];
    let keep = 0;
    lines.forEach((l, i) => {
      if (/platform_tools|version\.md|platform-tools|rename|extract|download/i.test(l)) {
        keep = 5;
      }
      if (keep > 0) {
        out.push((i + 1) + ": " + l);
        keep--;
      }
    });
    fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/agave-extract.txt", out.join("\n"));
  });
}).on("error", (e) => {
  fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/agave-extract.txt", "FETCH ERR: " + e.message);
});
