// Probe SpawnPad routes, writing each result immediately (crash-safe logging).
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/final-routes4.txt";
fs.writeFileSync(LOG, "");
const log = (s) => {
  fs.appendFileSync(LOG, s + "\n");
  console.log(s);
};
(async () => {
  for (const p of ["/", "/launch", "/explore", "/docs", "/trending", "/brand"]) {
    try {
      const x = await fetch("http://127.0.0.1:3000" + p);
      let extra = "";
      if (p === "/") {
        const t = await x.text();
        extra = ` | genesis:${t.includes("GENESIS")} banner:${t.includes("/images/Spawnpad-banner.png")}`;
      }
      log(p + " -> " + x.status + extra);
    } catch (e) {
      log(p + " -> ERR " + String(e.message).slice(0, 60));
    }
  }
  log("PROBE-DONE");
})();