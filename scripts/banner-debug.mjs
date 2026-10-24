// Debug banners.html: check script load errors + BANNERS visibility.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/banner-debug.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const RENDER = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/marketing/spawnpad-x-campaign/_render/banners.html";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e?.message || e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await page.goto("file:///" + RENDER.replace(/\\/g, "/") + "?n=1", { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(2_000);
  const info = await page.evaluate(() => ({
    bannersType: typeof window.BANNERS,
    bannerFiles: window.BANNER_FILES ? window.BANNER_FILES.join("|") : "(none)",
    stageChildren: document.getElementById("stage").children.length,
    hasAddressBar: !!document.querySelector(".addressbar"),
  }));
  append("page info: " + JSON.stringify(info));
  append("page errors: " + (errs.length ? "\n  " + errs.join("\n  ") : "NONE"));
  append("DEBUG-DONE");
} finally { await browser.close(); }