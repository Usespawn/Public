/**
 * Headless-browser verification of the token detail page (Playwright):
 *   - the uploaded logo <img> actually renders (natural size > 0)
 *   - the real market price text appears
 *   - the lightweight-charts canvas mounts when candles exist
 *   - screenshot saved as evidence
 */
const path = require("path");
const ROOT = "c:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const MINT = "BHwesn926yy2rtTChZ1Z5ZFXdWvgpirnj91yWmZodSpw";
const URL_BASE = "http://localhost:3001";

const out = [];
function log(...a) { out.push(a.join(" ")); }
function flush() { try { fs.writeFileSync(path.join(ROOT, "browser-verify.txt"), out.join("\n") + "\n"); } catch {} }
const fs = require("fs");

(async () => {
  log("== BROWSER VERIFY " + new Date().toISOString() + " ==");
  const { chromium } = require(path.join(ROOT, "node_modules", "playwright"));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e && e.message || e).slice(0, 160)));

  await page.goto(`${URL_BASE}/token/${MINT}`, { waitUntil: "networkidle", timeout: 60_000 });
  // Give the client effects time to fetch metadata + market + candles.
  await page.waitForTimeout(4500);

  // 1. Logo image — wait until it actually decodes pixels (or timeout).
  let logo = { found: false };
  try {
    await page.waitForFunction(
      () => {
        const img = document.querySelector('img[alt*="logo"], img[src*="ipfs"]');
        return !!img && img.complete && img.naturalWidth > 0;
      },
      { timeout: 30000 }
    );
  } catch {
    /* fall through to the snapshot below */
  }
  logo = await page.evaluate(() => {
    const img = document.querySelector('img[alt*="logo"], img[src*="ipfs"]');
    if (!img) return { found: false };
    return {
      found: true,
      src: img.getAttribute("src"),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  });
  log("logo: " + JSON.stringify(logo));
  log("logo renders pixels: " + (logo.found && logo.naturalWidth > 0 ? "YES" : "NO"));

  // 2. Real market price text (the token's true price from GeckoTerminal)
  const bodyText = await page.evaluate(() => document.body.innerText);
  const priceOk = bodyText.includes("live market data") || bodyText.includes("bonding curve");
  log("market badge present: " + String(priceOk));
  const priceMatch = bodyText.match(/\$0\.000002\d+/);
  log("price text found: " + (priceMatch ? priceMatch[0] : "(not in this render)"));

  // 3. Chart canvas (lightweight-charts renders <canvas> elements)
  const canvases = await page.evaluate(() => document.querySelectorAll("canvas").length);
  log("chart canvases mounted: " + canvases);

  // 4. Range tabs present
  const hasRanges = ["5m", "1h", "6h", "24h", "7d", "30d"].every((r) => bodyText.includes(r));
  log("all six range tabs present: " + String(hasRanges));

  // Screenshot evidence
  await page.screenshot({ path: path.join(ROOT, "screens", "token-detail-verified.png"), fullPage: true });
  log("screenshot: screens/token-detail-verified.png");

  log("page errors: " + (errors.length ? JSON.stringify(errors) : "NONE"));
  await browser.close();
  flush();
  console.log("BROWSER-VERIFY-DONE");
})().catch((e) => {
  log("FATAL " + (e && e.stack || e));
  flush();
  console.log("BROWSER-VERIFY-FATAL");
});