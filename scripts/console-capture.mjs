/**
 * Console / error capture for the SpawnPad homepage.
 * Loads the page in real Chromium (Playwright), collects:
 *  - console messages of type error/warning
 *  - uncaught page errors
 *  - failed network requests
 *  - Next.js dev-overlay error badge text (bottom-left "N error" indicator)
 * Writes everything to console-capture.log.
 */
import { chromium } from "playwright";
import { appendFileSync, writeFileSync } from "fs";

const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/console-capture.log";
writeFileSync(LOG, "");
const log = (s) => {
  appendFileSync(LOG, s + "\n");
  console.log(s);
};

const URL = process.argv[2] || "http://127.0.0.1:3000/";
log(`=== CONSOLE CAPTURE ${new Date().toISOString()} — ${URL} ===`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    log(`[console.${msg.type()}] ${msg.text().slice(0, 500)}`);
  }
});
page.on("pageerror", (err) => log(`[pageerror] ${String(err).slice(0, 800)}`));
page.on("requestfailed", (req) =>
  log(`[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`)
);
page.on("response", (res) => {
  if (res.status() >= 400) log(`[http ${res.status()}] ${res.url()}`);
});

try {
  await page.goto(URL, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(6000); // let hydration + wallets settle
  await page.mouse.move(700, 450);
  await page.waitForTimeout(1500);

  // Next.js dev overlay badge (bottom-left "N error" / "N issues")
  const badge = await page.evaluate(() => {
    const portal = document.querySelector("nextjs-portal");
    const root = portal && portal.shadowRoot;
    const all = root ? Array.from(root.querySelectorAll("*")) : [];
    const texts = all
      .map((e) => (e.textContent || "").trim())
      .filter((t) => /\b(error|issue|warning)s?\b/i.test(t) && t.length < 40);
    return texts.length ? Array.from(new Set(texts)).slice(0, 5) : ["(no dev-overlay badge text found)"];
  });
  log(`[dev-overlay badge] ${JSON.stringify(badge)}`);

  // Banner staticness: no animation may target the banner <img>
  const bannerCheck = await page.evaluate(() => {
    const img = document.querySelector('img[src*="Spawnpad-banner"]');
    if (!img) return { present: false, anims: 0, animatedByOthers: [] };
    const anims = document.getAnimations({ subtree: true });
    const touching = anims.filter((a) => {
      const el = a.effect && a.effect.target;
      return el === img || (el instanceof Element && el.contains(img));
    });
    // Who animates the region containing the banner? (should be nobody)
    const animatedByOthers = touching
      .map((a) => (a.animationName || a.constructor.name))
      .slice(0, 5);
    return {
      present: true,
      opacity: getComputedStyle(img).opacity,
      totalAnims: anims.length,
      touchingBanner: touching.length,
      animatedByOthers,
    };
  });
  log(`[banner staticness] ${JSON.stringify(bannerCheck)}`);

  // Digital Genesis present?
  const dg = await page.evaluate(() => {
    const svg = document.querySelector('svg[viewBox="0 0 420 420"]');
    return {
      svgPresent: !!svg,
      tracePaths: document.querySelectorAll("path[id^='dgPath']").length,
      nodeGroup: !!document.querySelector(".dg-nodes"),
    };
  });
  log(`[digital-genesis] ${JSON.stringify(dg)}`);
} catch (e) {
  log(`[fatal] ${e.message}`);
}

await browser.close();
log("CAPTURE-DONE");