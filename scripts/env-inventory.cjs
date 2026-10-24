// SpawnPad environment + API-credential inventory (Mainnet-readiness audit).
// Scans web/ source for env usage, RPC/endpoints, provider init, secrets.
// Writes findings grouped by pattern. Never prints secret VALUES from env files.
const fs = require("fs");
const path = require("path");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/inventory.txt";
const ROOT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";
const SKIP = /node_modules|\.next|\.git|dist|coverage|\.data/;
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx", ".json", ".md"]);

fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const PATTERNS = [
  ["ENV-DIRECT", /process\.env\.[A-Za-z0-9_]+/],
  ["ENV-DYNAMIC", /process\.env\[|import\.meta\.env/],
  ["NEXT_PUBLIC", /NEXT_PUBLIC_[A-Za-z0-9_]+/],
  ["RPC-URL-LITERAL", /https?:\/\/[a-z0-9.\-]*(api|rpc|devnet|mainnet|alchemy|helius|quicknode|drpc)[a-z0-9.\-]*/i],
  ["CLUSTER-API-URL", /clusterApiUrl/],
  ["WALLET-NETWORK", /WalletAdapterNetwork|wallet-adapter-network/i],
  ["CONNECTION-CTOR", /new Connection\(/],
  ["AUTH-HEADER", /Authorization|Bearer\s/],
  ["SDK-INIT", /PUMP_SDK|pump-sdk|pump-sdk-web/i],
  ["DB-CLIENT", /prisma|mongoose|postgres|mysql|supabase|redis|sqlite|typeorm/i],
  ["PROVIDER-CTOR", /new (Alchemy|Helius|ConnectionProvider|WalletProvider)\b/i],
  ["OUTBOUND-FETCH", /fetch\(\s*[`"']https?:\/\//],
];

const hits = {};
for (const [name] of PATTERNS) hits[name] = [];

(function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.test(p)) walk(p); continue; }
    if (!EXTS.has(path.extname(e.name))) continue;
    if (/package-lock\.json|tsconfig\.tsbuildinfo/.test(e.name)) continue;
    let src;
    try { src = fs.readFileSync(p, "utf8"); } catch { continue; }
    const rel = path.relative(ROOT, p);
    src.split("\n").forEach((line, i) => {
      for (const [name, re] of PATTERNS) {
        if (re.test(line)) {
          hits[name].push(`${rel}:${i + 1}: ${line.trim().slice(0, 170)}`);
        }
      }
    });
  }
})(ROOT);

for (const [name] of PATTERNS) {
  append(`\n=== ${name} (${hits[name].length}) ===`);
  for (const h of hits[name]) append(h);
}
append("\nINVENTORY-DONE");