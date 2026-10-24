// Extract sdk.ts createV2Instruction body (1384-1545) via line slicing.
const fs = require("fs");
const SRC = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/@pump-fun/pump-sdk/src/sdk.ts";
const OUT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/sdk-createv2.txt";
const lines = fs.readFileSync(SRC, "utf8").split("\n");
fs.writeFileSync(OUT, lines.slice(1383, 1545).join("\n"));
fs.appendFileSync(OUT, "\nEXTRACT-DONE");