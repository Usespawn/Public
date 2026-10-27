/**
 * Pixel-level verification of the re-rendered banner 01:
 *  - hash must differ from the backed-up old (emblem) version
 *  - the center logo area must contain bright (white wordmark) pixels —
 *    the old circular emblem had none there
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");

const ROOT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const NEW_PNG = path.join(ROOT, "marketing/spawnpad-x-campaign/banners/01-introducing-spawnpad.png");
const OLD_PNG = path.join(ROOT, "marketing/spawnpad-x-campaign/_render/01-introducing-spawnpad.previous.png");
const LOG = path.join(ROOT, "banner-pixel-check.txt");

const out = [];
const log = (s) => out.push(s);

const hashOf = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0, 16);
const newHash = hashOf(NEW_PNG);
const oldHash = hashOf(OLD_PNG);
log("new hash=" + newHash + "  old(backup) hash=" + oldHash + "  changed=" + (newHash !== oldHash));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const dataUrl = "data:image/png;base64," + fs.readFileSync(NEW_PNG).toString("base64");
  const stats = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    // Center logo band: the lockup occupies ~409x150 centered at (800, ~315).
    const x0 = 595, x1 = 1005, y0 = 235, y1 = 395;
    let bright = 0, cyan = 0, total = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        const sum = d[0] + d[1] + d[2];
        total++;
        if (sum > 600) bright++;                       // white wordmark strokes
        if (d[2] > 200 && d[1] > 180) cyan++;          // cyan-ish glyph/gradient
      }
    }
    return { bright, cyan, total };
  }, dataUrl);
  log("center band scan: " + JSON.stringify(stats));
  log("white wordmark pixels present: " + (stats.bright > 40 ? "YES" : "NO"));
  log("cyan/violet logo pixels present: " + (stats.cyan > 40 ? "YES" : "NO"));
  await browser.close();
  fs.writeFileSync(LOG, out.join("\n") + "\n");
  console.log("PIXEL-CHECK-DONE");
})().catch((e) => {
  out.push("FATAL " + (e && e.stack || e));
  fs.writeFileSync(LOG, out.join("\n") + "\n");
  console.log("PIXEL-CHECK-FATAL");
});