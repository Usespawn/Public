// Campaign banner renderer: screenshot each ?n=N composition at 1600x900
// into marketing/spawnpad-x-campaign/banners/, plus a contact sheet.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const BASE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const RENDER = BASE + "/marketing/spawnpad-x-campaign/_render/banners.html";
const OUTDIR = BASE + "/marketing/spawnpad-x-campaign/banners";
fs.mkdirSync(OUTDIR, { recursive: true });
const LOG = BASE + "/marketing/spawnpad-x-campaign/banners/render-log.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  for (let n = 1; n <= 15; n++) {
    await page.goto("file:///" + RENDER.replace(/\\/g, "/") + "?n=" + n, { waitUntil: "load", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const stage = page.locator("#stage");
    const file = path.join(OUTDIR, await page.evaluate(() => window.BANNER_FILES[n - 1]));
    await stage.screenshot({ path: file });
    const dim = await page.evaluate(() => {
      const el = document.getElementById("stage");
      return el.offsetWidth + "x" + el.offsetHeight;
    });
    append(`${String(n).padStart(2, "0")} -> ${path.basename(file)} (${dim})`);
  }
  // Contact sheet (n=0 with 15 iframes).
  await page.goto("file:///" + RENDER.replace(/\\/g, "/") + "?n=0", { waitUntil: "load", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2_500);
  await page.locator("#stage").screenshot({ path: path.join(OUTDIR, "00-contact-sheet.png") });
  append("00 -> 00-contact-sheet.png");
  append("CAMPAIGN-SHOTS-DONE");
} catch (e) {
  append("CAMPAIGN-SHOTS-FAILED: " + String(e?.message || e).slice(0, 300));
  process.exitCode = 1;
} finally {
  await browser.close();
}