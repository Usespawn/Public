// Inspect vanity-ground.json structure: key names and value types ONLY.
const fs = require("fs");
const BASE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const LOG = BASE + "/ground-struct.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const raw = fs.readFileSync(BASE + "/vanity-ground.json", "utf8");
append(`file length: ${raw.length}`);

// key names with value type signature (no values)
const kv = [...raw.matchAll(/"([A-Za-z_]+)"\s*:\s*/g)].map((m) => m[1]);
append(`key names in order: ${kv.join(", ")}`);

// For each key: print type + (for short non-secret strings) the value shape
for (const m of raw.matchAll(/"([A-Za-z_]+)"\s*:\s*("?[^,}\n]{0,40})/g)) {
  const [, k, v] = m;
  const isSecretish = /secret|priv|key|seed/i.test(k);
  append(`${k}: ${isSecretish ? "<redacted " + (v.trim().startsWith("[") ? "array]" : "string/number]") : v.trim().slice(0, 50)}`);
}
append("STRUCT-DONE");