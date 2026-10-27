/** Finishes live verification: token page HTML logo + durable registry. */
const fs = require("fs");
const path = require("path");
const ROOT = "c:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const BASE = "http://localhost:3001";
const out = [];
function log(...a) { out.push(a.join(" ")); }
function flush() { try { fs.writeFileSync(path.join(ROOT, "live-verify3.txt"), out.join("\n") + "\n"); } catch {} }

(async () => {
  // 4. Token detail page HTML carries the logo image URL
  const metaRes = await fetch(`${BASE}/api/token-meta/${MINT}`);
  const metaBody = await metaRes.json();
  const imageUrl = metaBody?.meta?.image ?? null;
  const page = await fetch(`${BASE}/token/${MINT}`, { signal: AbortSignal.timeout(45000) });
  const html = await page.text();
  log("4) token page -> status=" + page.status +
    " bytes=" + html.length +
    " logoUrl=" + JSON.stringify(imageUrl) +
    " logoInHtml=" + (imageUrl ? String(html.includes(imageUrl)) : "n/a") +
    " chartBundle=" + String(html.includes("_next/static/chunks")));
  flush();

  // 5. Durable registry
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "web", ".data", "market.json"), "utf8"));
    const entry = reg.find((e) => e.mint === MINT);
    log("5) market registry -> entries=" + reg.length +
      " indexed=" + (entry?.indexed ?? "absent") +
      " pool=" + (entry?.poolAddress ?? "-") +
      " kind=" + (entry?.poolKind ?? "-") +
      " source=" + (entry?.source ?? "-") +
      " retryCount=" + (entry?.retryCount ?? "-") +
      " lastGoodAt=" + (entry?.lastGoodAt ?? "-"));
  } catch (e) {
    log("5) registry ERROR " + String(e && e.message || e).slice(0, 120));
  }
  flush();
  console.log("FINISH-DONE");
})().catch((e) => {
  log("FATAL " + (e && e.stack || e));
  flush();
  console.log("FINISH-FATAL");
});