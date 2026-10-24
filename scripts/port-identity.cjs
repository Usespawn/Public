// Verify what's serving port 3000 + full dev-log identity check.
const fs = require("fs");
const http = require("http");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/port3000-identity.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

http.get("http://127.0.0.1:3000/", (res) => {
  let body = "";
  res.on("data", (c) => (body += c));
  res.on("end", () => {
    const title = (body.match(/<title>([^<]*)<\/title>/) || [])[1] || "(no title)";
    append(`HTTP ${res.statusCode}; title: ${title}`);
    append(`is SpawnPad: ${/spawn/i.test(title) || /SpawnPad/.test(body) ? "YES" : "NO"}`);
    append(`has wallet-adapter markup: ${body.includes("wallet-adapter") ? "YES" : "no"}`);
    append(`next dev marker (/_next/static/development): ${body.includes("/_next/static/development") ? "YES (dev server)" : "no"}`);
    append("IDENTITY-DONE");
  });
}).on("error", (e) => { append("FETCH-FAILED: " + e.message); append("IDENTITY-DONE"); });