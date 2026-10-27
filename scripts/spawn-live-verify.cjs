/**
 * LIVE VERIFICATION (no blockchain transactions — the reconcile endpoint only
 * READS Solana and writes to SpawnPad's local verified-launch registry):
 *   1. GET  /api/launches?verified=1            -> baseline (expect empty)
 *   2. POST /api/launches/reconcile {mint}      -> server verifies on-chain
 *   3. GET  /api/launches?verified=1            -> token MUST be listed
 *   4. POST /api/launches/reconcile again       -> alreadyListed (idempotent)
 *   5. GET  /api/launches                       -> exactly one record
 */
const fs = require("fs");
const path = require("path");
const ROOT = "c:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const BASE_CANDIDATES = ["http://localhost:3000", "http://localhost:3001"];
let BASE = "";

const out = [];
function log(...a) { out.push(a.join(" ")); }
function flush() { try { fs.writeFileSync(path.join(ROOT, "live-verify.txt"), out.join("\n") + "\n"); } catch {} }

async function getJson(url, init) {
  const res = await fetch(url, init);
  let body = null;
  try { body = await res.json(); } catch { body = "(non-JSON)"; }
  return { status: res.status, body };
}

(async () => {
  log("== LIVE LISTING VERIFICATION " + new Date().toISOString() + " ==");
  for (let attempt = 0; attempt < 2 && !BASE; attempt++) {
    for (const base of BASE_CANDIDATES) {
      try {
        const probe = await fetch(base + "/api/launches?limit=1", { signal: AbortSignal.timeout(20000) });
        if (probe.ok) { BASE = base; break; }
      } catch { /* try next */ }
    }
    if (!BASE) await new Promise((r) => setTimeout(r, 3000));
  }
  if (!BASE) { log("No dev server reachable on " + BASE_CANDIDATES.join(", ")); flush(); console.log("LIVE-VERIFY-NOSERVER"); return; }
  log("using dev server at " + BASE);

  // 1. Baseline
  let r = await getJson(`${BASE}/api/launches?verified=1&limit=100`);
  log("1) GET verified listings -> status=" + r.status +
    " records=" + (Array.isArray(r.body?.records) ? r.body.records.length : JSON.stringify(r.body).slice(0, 120)));
  const before = Array.isArray(r.body?.records) ? r.body.records : [];

  // 2. Reconcile
  r = await getJson(`${BASE}/api/launches/reconcile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mint: MINT }),
  });
  log("2) POST reconcile -> status=" + r.status +
    " ok=" + r.body?.ok +
    (r.body?.error ? " error=" + r.body.error : "") +
    (r.body?.record ? " record.status=" + r.body.record.status +
      " name=" + JSON.stringify(r.body.record.name) +
      " symbol=" + JSON.stringify(r.body.record.symbol) +
      " uri=" + JSON.stringify(r.body.record.uri ?? null) +
      " signature=" + String(r.body.record.signature ?? "").slice(0, 20) + "…" : ""));
  flush();

  // 3. The token must now appear
  r = await getJson(`${BASE}/api/launches?verified=1&limit=100`);
  const after = Array.isArray(r.body?.records) ? r.body.records : [];
  const found = after.find((x) => x.mint === MINT);
  log("3) GET verified listings -> status=" + r.status + " records=" + after.length +
    " TOKEN_LISTED=" + (found ? "YES" : "NO") +
    (found ? " name=" + JSON.stringify(found.name) + " symbol=" + JSON.stringify(found.symbol) +
      " status=" + found.status : ""));
  flush();

  // 4. Idempotency
  r = await getJson(`${BASE}/api/launches/reconcile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mint: MINT }),
  });
  log("4) POST reconcile again -> status=" + r.status +
    " alreadyListed=" + r.body?.alreadyListed + " ok=" + r.body?.ok);
  flush();

  // 5. Duplicate check
  r = await getJson(`${BASE}/api/launches?limit=100`);
  const all = Array.isArray(r.body?.records) ? r.body.records : [];
  const dupes = all.filter((x) => x.mint === MINT).length;
  log("5) GET all listings -> records=" + all.length + " occurrences_of_mint=" + dupes);
  log(before.length === 0 && found && dupes === 1 ? "VERDICT: PASS — token appears exactly once in SpawnPad listings." :
    "VERDICT: CHECK OUTPUT ABOVE.");
  flush();
  console.log("LIVE-VERIFY-DONE");
})().catch((e) => {
  log("FATAL: " + (e && e.stack || e));
  flush();
  console.log("LIVE-VERIFY-FATAL");
});