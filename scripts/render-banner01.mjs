/**
 * Re-renders banner 01 (01-introducing-spawnpad.png) from
 * marketing/spawnpad-x-campaign/_render/banners.html?n=1 at 1600x900.
 * Verifies inside the page that the center logo is the real SpawnPad logo,
 * then screenshots and checks the PNG header dimensions.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const RENDER = path.join(ROOT, "marketing/spawnpad-x-campaign/_render/banners.html");
const OUT = path.join(ROOT, "marketing/spawnpad-x-campaign/banners/01-introducing-spawnpad.png");
const LOG = path.join(ROOT, "render-banner01-log.txt");

const append = (s) => fs.appendFileSync(LOG, s + "\n");
fs.writeFileSync(LOG, "");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e?.message || e).slice(0, 200)));
  await page.goto("file:///" + RENDER.replace(/\\/g, "/") + "?n=1", { waitUntil: "networkidle", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  // Ensure the CENTER logo (not the topbar wordmark) actually decoded.
  const logo = await page.evaluate(async () => {
    const img = document.querySelector('.frame img:not(.wordmark)[alt="SpawnPad"]');
    if (!img) return { found: false };
    try { await img.decode(); } catch { /* still report dims */ }
    return {
      found: true,
      src: img.getAttribute("src"),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      renderedWidth: Math.round(img.getBoundingClientRect().width),
      renderedHeight: Math.round(img.getBoundingClientRect().height),
    };
  });
  append("center logo: " + JSON.stringify(logo));
  append("page errors: " + (errs.length ? errs.join(" | ") : "NONE"));
  if (!logo.found || !logo.complete || logo.naturalWidth === 0) {
    append("LOGO-NOT-LOADED — aborting screenshot");
    process.exitCode = 1;
  } else {
    await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1600, height: 900 } });
    const buf = fs.readFileSync(OUT);
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    append("screenshot: " + OUT);
    append("png: isPng=" + isPng + " " + w + "x" + h + " bytes=" + buf.length);
    append("RENDER-BANNER01-DONE");
  }
} finally {
  await browser.close();
}