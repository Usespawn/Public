// Check whether the Next dev server is reachable (writes result to file).
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/srv-check.txt";
fs.writeFileSync(LOG, "checking...\n");
fetch("http://localhost:3000/", { signal: AbortSignal.timeout(15000) })
  .then((r) => fs.appendFileSync(LOG, `HTTP ${r.status}\nSRV-UP`))
  .catch((e) => fs.appendFileSync(LOG, `DOWN: ${e.cause ? e.cause.code || e.cause.message : e.message}\nSRV-DOWN`));