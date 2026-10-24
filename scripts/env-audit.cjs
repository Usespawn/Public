// Env audit: every process.env / NEXT_PUBLIC_ reference in the web app source.
// Writes output incrementally (environment kills long-running procs).
const fs = require("fs");
const path = require("path");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/env-audit.txt";
const ROOT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";
const SKIP = /node_modules|\.next|\.git|dist|coverage/;
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"]);

fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const direct = new Map(); // name -> [{file, line, text}]
const dynamic = [];
const other = [];

(function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.test(p)) walk(p); continue; }
    if (!EXTS.has(path.extname(e.name))) continue;
    let src;
    try { src = fs.readFileSync(p, "utf8"); } catch { continue; }
    const rel = path.relative(ROOT, p);
    src.split("\n").forEach((line, i) => {
      const m = line.match(/process\.env\.([A-Za-z0-9_]+)/g);
      if (m) {
        for (const name of m.map((s) => s.replace("process.env.", ""))) {
          if (!direct.has(name)) direct.set(name, []);
          direct.get(name).push({ file: rel, line: i + 1, text: line.trim().slice(0, 160) });
        }
      } else if (/process\.env/.test(line)) {
        // destructure or whole-object usage: const { X } = process.env | process.env as arg
        other.push(`${rel}:${i + 1}: ${line.trim().slice(0, 200)}`);
      }
      if (/process\.env\[|env\[`|env\['|env\["/.test(line)) {
        dynamic.push(`${rel}:${i + 1}: ${line.trim().slice(0, 160)}`);
      }
    });
  }
})(ROOT);

append("=== DIRECT process.env.<NAME> references ===");
for (const [name, refs] of [...direct.entries()].sort()) {
  append(`\n${name} (${refs.length} refs):`);
  for (const r of refs) append(`  ${r.file}:${r.line}: ${r.text}`);
}
append("\n=== dynamic env access (process.env[...]) ===");
if (dynamic.length === 0) append("(none)");
for (const d of dynamic) append(d);
append("\n=== other process.env usage (destructuring / whole object) ===");
if (other.length === 0) append("(none)");
for (const o of other) append(o);
append("\n=== UNIQUE NAMES ===");
append([...direct.keys()].sort().join(", "));
append("\nENV-AUDIT-DONE");