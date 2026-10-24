// X-logo verification: desktop + mobile nav, attributes, click behavior.
// External x.com requests are aborted (no real navigation); popup event
// confirms target="_blank" behavior. Read-only UI check.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/x-verify.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const done = (c) => { append("X-VERIFY-" + (c ? "PASS" : "FAIL")); process.exit(c ? 0 : 1); };

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  // Abort any x.com request (verification must not hit the real network).
  await ctx.route("**x.com/**", (r) => r.abort());

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // Desktop: anchor exists and attributes are exact.
  const a = page.locator('a[aria-label="SpawnPad on X"]').first();
  if (!(await a.count())) { append("desktop anchor: MISSING"); return done(false); }
  append("desktop anchor: present");
  append("desktop href: " + (await a.getAttribute("href")));
  append("desktop target: " + (await a.getAttribute("target")));
  append("desktop rel: " + (await a.getAttribute("rel")));
  append("desktop title: " + (await a.getAttribute("title")));
  append("desktop visible (lg 1280px): " + (await a.isVisible()));

  // "Launch Token" pill is present and sits left of the X anchor.
  const pill = page.locator('a[href="/launch"]').first();
  append("launch pill visible: " + (await pill.isVisible()));
  const pillBox = await pill.boundingBox();
  const aBox = await a.boundingBox();
  append("pill right edge: " + (pillBox ? Math.round(pillBox.x + pillBox.width) : "n/a"));
  append("x anchor left edge: " + (aBox ? Math.round(aBox.x) : "n/a"));
  append("x anchor box: " + (aBox ? `${Math.round(aBox.width)}x${Math.round(aBox.height)}` : "n/a"));
  append("beside (gap>0, same row): " + (pillBox && aBox ? (aBox.x > pillBox.x + pillBox.width - 2 && aBox.y < pillBox.y + pillBox.height) : false));

  await page.screenshot({ path: "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/x-desktop.png" });

  // Click the X anchor -> popup opens (target=_blank), original page stays on /.
  const [popup] = await Promise.all([
    ctx.waitForEvent("page", { timeout: 5000 }).catch(() => null),
    a.click(),
  ]);
  append("click opened new tab: " + (popup ? "YES" : "NO"));
  if (popup) append("popup URL: " + popup.url());
  append("original page stayed on: " + page.url());

  // Launch Token pill still navigates internally.
  await pill.click();
  await page.waitForTimeout(1500);
  append("launch pill navigated to: " + page.url());

  // Mobile viewport (390x844).
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
  await mob.waitForTimeout(2000);
  const mobA = mob.locator('a[aria-label="SpawnPad on X"]').first();
  append("mobile: anchor present: " + (await mobA.count()));
  append("mobile: anchor visible with menu closed: " + (await mobA.isVisible()));
  await mob.locator('button[aria-label="Toggle navigation menu"]').click();
  await mob.waitForTimeout(500);
  append("mobile: anchor visible with menu open: " + (await mobA.isVisible()));
  append("mobile: href: " + (await mobA.getAttribute("href")));
  append("mobile: target: " + (await mobA.getAttribute("target")));
  append("mobile: rel: " + (await mobA.getAttribute("rel")));
  const overflow = await mob.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  append("mobile: horizontal overflow: " + (overflow ? "YES (problem)" : "none"));
  await mob.screenshot({ path: "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/x-mobile-menu.png" });

  append("console/page errors: " + (errors.length === 0 ? "NONE" : String(errors.length)));
  for (const e of errors) append("  " + e);
  return done(errors.length === 0);
} catch (e) {
  append("CHECK-FAILED: " + String(e?.message || e).slice(0, 300));
  return done(false);
} finally {
  await browser.close();
}