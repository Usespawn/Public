/**
 * FULL live verification (read-only for the chain; writes only SpawnPad's
 * local registries via its own APIs):
 *   1. GET  /api/token-meta/[mint]        -> logo recovery via gateway chain
 *   2. GET  /api/market/[mint]            -> discovery + market summary
 *   3. GET  /api/market/[mint]/candles    -> genuine OHLCV or honest state
 *   4. GET  /token/[mint]                 -> page HTML renders the logo
 *   5. inspect .data/market.json          -> durable registry persisted
 */
const fs = require("fs");
const path = require("path");
const ROOT = "c:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const BASE_CANDIDATES = ["http://localhost:3001", "http://localhost:3000"];

const out = [];
function log(...a) { out.push(a.join(" ")); }
function flush() { try { fs.writeFileSync(path.join(ROOT, "live-verify2.txt"), out.join("\n") + "\n"); } catch {} }

async function getJson(url, init) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), ...init });
  let body = null;
  try { body = await res.json(); } catch { body = "(non-JSON)"; }
  return { status: res.status, body };
}

(async () => {
  log("== FULL LIVE VERIFICATION " + new Date().toISOString() + " ==");
  let BASE = "";
  for (const base of BASE_CANDIDATES) {
    try {
      const probe = await fetch(base + "/api/launches?limit=1", { signal: AbortSignal.timeout(20000) });
      if (probe.ok) { BASE = base; break; }
    } catch { /* next */ }
  }
  if (!BASE) { log("dev server unreachable on " + BASE_CANDIDATES.join(", ")); flush(); console.log("NOSERVER"); return; }
  log("server: " + BASE);

  // 1. Token metadata / logo recovery
  let r = await getJson(`${BASE}/api/token-meta/${MINT}`);
  const meta = r.body?.meta ?? null;
  log("1) token-meta -> status=" + r.status +
    " source=" + (meta?.source ?? "?") +
    " name=" + JSON.stringify(meta?.name ?? null) +
    " symbol=" + JSON.stringify(meta?.symbol ?? null) +
    " image=" + JSON.stringify(meta?.image ?? null) +
    " resolvedVia=" + JSON.stringify(meta?.resolvedVia ?? null));
  flush();

  // 2. Market summary (triggers bounded discovery + registry persistence)
  r = await getJson(`${BASE}/api/market/${MINT}`);
  const s = r.body?.summary ?? null;
  log("2) market summary -> status=" + r.status +
    " market.status=" + (s?.status ?? "?") +
    " indexed=" + (s?.indexed ?? "?") +
    " poolKind=" + (s?.pool?.kind ?? "?") +
    " poolAddress=" + (s?.pool?.address ?? "?") +
    " priceUsd=" + (s?.priceUsd ?? null) +
    " curvePriceUsd=" + (s?.curvePriceUsd ?? null) +
    " priceSOL=" + (s?.priceSOL ?? null) +
    " liquidityUsd=" + (s?.liquidityUsd ?? null) +
    " priceSource=" + (s?.priceSource ?? "?") +
    " graduation.completed=" + (s?.graduation?.completed ?? "?"));
  flush();

  // 3. Candles (genuine OHLCV or honest no-history)
  r = await getJson(`${BASE}/api/market/${MINT}/candles?range=24h`);
  const c = r.body ?? {};
  log("3) candles 24h -> status=" + r.status +
    " candleStatus=" + (c.status ?? "?") +
    " count=" + (Array.isArray(c.candles) ? c.candles.length : "?") +
    (Array.isArray(c.candles) && c.candles.length
      ? " first=" + JSON.stringify(c.candles[0])
      : " note=" + JSON.stringify(c.note ?? null)));
  flush();

  // 4. Token detail page HTML must carry the logo image URL
  try {
    const page = await fetch(`${BASE}/token/${MINT}`, { signal: AbortSignal.timeout(45000) });
    const html = await page.text();
    const imgOk = meta?.image ? html.includes(meta.image) : false;
    const hasChartLib = html.includes("lightweight-charts") || html.includes("_next/static");
    log("4) token page -> status=" + page.status +
      " bytes=" + html.length +
      " logoInHtml=" + (meta?.image ? String(imgOk) : "n/a(no image)") +
      " pageAssets=" + String(hasChartLib));
  } catch (e) {
    log("4) token page ERROR " + String(e && e.message || e).slice(0, 120));
  }
  flush();

  // 5. Registry persisted
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "web", ".data", "market.json"), "utf8"));
    const entry = reg.find((e) => e.mint === MINT);
    log("5) market registry -> entries=" + reg.length +
      " entry.indexed=" + (entry?.indexed ?? "absent") +
      " pool=" + (entry?.poolAddress ?? "-") +
      " kind=" + (entry?.poolKind ?? "-") +
      " source=" + (entry?.source ?? "-") +
      " retryCount=" + (entry?.retryCount ?? "-"));
  } catch (e) {
    log("5) market registry ERROR " + String(e && e.message || e).slice(0, 120));
  }
  flush();
  console.log("FULL-VERIFY-DONE");
})().catch((e) => {
  log("FATAL " + (e && e.stack || e));
  flush();
  console.log("FULL-VERIFY-FATAL");
});