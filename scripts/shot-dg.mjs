/**
 * Hero screenshots (desktop + mobile) via Playwright — real Chromium,
 * waits for hydration and the Digital Genesis mid-sequence state.
 * Also grabs a second desktop frame ~4s later to show the animation moved.
 */
import { chromium } from "playwright";
import { mkdirSync, appendFileSync } from "fs";

const OUT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/brand";
mkdirSync(OUT, { recursive: true });
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/shot-dg.log";
appendFileSync(LOG, `=== DG SHOTS ${new Date().toISOString()} ===\n`);
const log = (s) => {
  appendFileSync(LOG, s + "\n");
  console.log(s);
};

const browser = await chromium.launch();
const URL = "http://127.0.0.1:3000/";

// Desktop
const d = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await d.goto(URL, { waitUntil: "load", timeout: 90000 });
await d.waitForTimeout(4500); // mid-sequence (ring expanding / nodes traveling)
await d.screenshot({ path: `${OUT}/dg-desktop.png` });
log("desktop ok");
await d.waitForTimeout(4200); // later in the sequence (emblem highlight window)
await d.screenshot({ path: `${OUT}/dg-desktop-t2.png` });
log("desktop-t2 ok");
await d.close();

// Mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await m.goto(URL, { waitUntil: "load", timeout: 90000 });
await m.waitForTimeout(4500);
await m.screenshot({ path: `${OUT}/dg-mobile.png` });
log("mobile ok");
await m.close();

await browser.close();
log("DG-SHOTS-DONE");