// CA chip verification (TBA state): adjacency to X logo, TBA behavior
// (click shows "Official CA coming soon", clipboard NEVER written),
// mobile menu layout, overflow, console errors.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/ca-verify.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const done = (ok) => { append("CA-VERIFY-" + (ok ? "PASS" : "FAIL")); };

const browser = await chromium.launch({ headless: true });
let ok = true;
try {
  const main = async () => {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 150)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 150)); });

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3_000);

  // Desktop chip: exists, right of X anchor, same row.
  const chip = page.locator('button[aria-label="Official Spawn token CA coming soon"]').first();
  if (!(await chip.count())) { append("chip: MISSING"); return false; }
  append("chip (TBA aria-label): present + visible=" + (await chip.isVisible()));
  const chipText = (await chip.innerText()).replace(/\s+/g, " ").trim();
  append("chip text: " + JSON.stringify(chipText));
  ok = ok && /SPAWN CA/.test(chipText) && /TBA/.test(chipText);
  const x = page.locator('a[aria-label="SpawnPad on X"]').first();
  const xb = await x.boundingBox();
  const cb = await chip.boundingBox();
  append(`x anchor box: right=${xb ? Math.round(xb.x + xb.width) : "?"} y=${xb ? Math.round(xb.y) : "?"}`);
  append(`chip box: left=${cb ? Math.round(cb.x) : "?"} y=${cb ? Math.round(cb.y) : "?"} w=${cb ? Math.round(cb.width) : "?"}`);
  const adjacent = xb && cb && cb.x >= xb.x + xb.width - 2 && Math.abs(cb.y - xb.y) < 20;
  append("chip immediately right of X logo, same row: " + (adjacent ? "YES" : "NO"));
  ok = ok && !!adjacent;

  // TBA click: shows coming-soon message; clipboard must NOT contain TBA.
  await chip.click();
  await page.waitForTimeout(400);
  const during = (await chip.innerText()).replace(/\s+/g, " ").trim();
  append("after TBA click, chip shows: " + JSON.stringify(during));
  ok = ok && /Official CA coming soon/i.test(during);
  let clip = "(unavailable)";
  try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch {}
  append("clipboard after TBA click: " + JSON.stringify(clip));
  ok = ok && (clip === "(unavailable)" || clip === "" || !/TBA/i.test(clip));
  await page.waitForTimeout(2200);
  const after = (await chip.innerText()).replace(/\s+/g, " ").trim();
  append("chip restored to: " + JSON.stringify(after));

  await page.screenshot({ path: "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/x-ca-desktop.png" });

  // Mobile: menu open, chip next to X, no overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1_000);
  await page.locator('button[aria-label="Toggle navigation menu"]').click();
  await page.waitForTimeout(800);
  const mchip = page.locator('button[aria-label="Official Spawn token CA coming soon"]').nth(1); // 2nd instance = mobile menu chip
  append("mobile chip visible (menu open): " + (await mchip.isVisible()));
  append("mobile chip text: " + JSON.stringify((await mchip.innerText()).replace(/\s+/g, " ").trim()));
  const mxb = await page.locator('a[aria-label="SpawnPad on X"]').first().boundingBox();
  const mcb = await mchip.boundingBox();
  append(`mobile adjacency: chip.left=${mcb ? Math.round(mcb.x) : "?"} vs x.right=${mxb ? Math.round(mxb.x + mxb.width) : "?"}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  append("mobile horizontal overflow: " + (overflow ? "YES (problem)" : "none"));
  ok = ok && !overflow;
  await page.screenshot({ path: "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/x-ca-mobile.png" });

  append("console/page errors: " + (errors.length === 0 ? "NONE" : String(errors.length)));
  for (const e of errors) append("  " + e);
  ok = ok && errors.length === 0;
  return ok;
  }; // end main
  ok = await main();
} catch (e) {
  append("CHECK-FAILED: " + String(e?.message || e).slice(0, 300));
  ok = false;
} finally {
  await browser.close();
}
done(ok);
process.exit(ok ? 0 : 1);