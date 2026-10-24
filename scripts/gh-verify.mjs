// GitHub icon verification: grouped with X logo, exact hrefs/target/rel,
// popup on click, CA chip still after both, mobile visibility, overflow, console.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/gh-verify.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
let ok = true;

const browser = await chromium.launch({ headless: true });
try {
  const main = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 150)));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 150)); });
    // Block external requests; popup event still proves target=_blank.
    await ctx.route("**x.com/**", (r) => r.abort());
    await ctx.route("**github.com/**", (r) => r.abort());

    await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3_000);

    const gh = page.locator('a[aria-label="SpawnPad on GitHub"]').first();
    if (!(await gh.count())) { append("github anchor: MISSING"); return false; }
    append("github anchor: present visible=" + (await gh.isVisible()));
    append("github href: " + (await gh.getAttribute("href")));
    append("github target: " + (await gh.getAttribute("target")));
    append("github rel: " + (await gh.getAttribute("rel")));
    append("github title: " + (await gh.getAttribute("title")));
    ok = ok && (await gh.getAttribute("href")) === "https://github.com/Usespawn";
    ok = ok && (await gh.getAttribute("target")) === "_blank";
    ok = ok && (await gh.getAttribute("rel")) === "noopener noreferrer";

    // X anchor unchanged.
    const x = page.locator('a[aria-label="SpawnPad on X"]').first();
    const xHref = await x.getAttribute("href");
    append("x href unchanged: " + (xHref === "https://x.com/spawnpadHQ" ? "YES" : "NO — " + xHref));
    ok = ok && xHref === "https://x.com/spawnpadHQ";

    // Adjacency: X -> GitHub -> CA chip, same row.
    const xb = await x.boundingBox();
    const gb = await gh.boundingBox();
    const chip = page.locator('button[aria-label="Official Spawn token CA coming soon"]').first();
    const cb = await chip.boundingBox();
    append(`x right=${xb ? Math.round(xb.x + xb.width) : "?"} y=${xb ? Math.round(xb.y) : "?"}`);
    append(`gh left=${gb ? Math.round(gb.x) : "?"} right=${gb ? Math.round(gb.x + gb.width) : "?"} y=${gb ? Math.round(gb.y) : "?"}`);
    append(`chip left=${cb ? Math.round(cb.x) : "?"} y=${cb ? Math.round(cb.y) : "?"}`);
    const adj = xb && gb && cb &&
      gb.x >= xb.x + xb.width - 2 &&
      cb.x >= gb.x + gb.width - 2 &&
      Math.abs(gb.y - xb.y) < 20 && Math.abs(cb.y - gb.y) < 20;
    append("order X -> GitHub -> CA chip on one row: " + (adj ? "YES" : "NO"));
    ok = ok && !!adj;

    await page.screenshot({ path: "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/gh-desktop.png" });

    // GitHub click -> popup (target=_blank), page stays.
    const [popup] = await Promise.all([
      ctx.waitForEvent("page", { timeout: 5000 }).catch(() => null),
      gh.click(),
    ]);
    append("github click opened new tab: " + (popup ? "YES" : "NO"));
    if (popup) append("popup URL: " + popup.url());
    append("page still on: " + page.url());

    // Mobile: both icons visible, no overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1_000);
    await page.locator('button[aria-label="Toggle navigation menu"]').click();
    await page.waitForTimeout(800);
    const mgh = page.locator('a[aria-label="SpawnPad on GitHub"]').nth(1); // 2nd = mobile instance
    const mx = page.locator('a[aria-label="SpawnPad on X"]').nth(1);
    append("mobile github visible: " + (await mgh.isVisible()));
    append("mobile github href: " + (await mgh.getAttribute("href")));
    append("mobile x href: " + (await mx.getAttribute("href")));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    append("mobile horizontal overflow: " + (overflow ? "YES (problem)" : "none"));
    ok = ok && (await mgh.isVisible()) && !overflow;
    await page.screenshot({ path: "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/gh-mobile.png" });

    append("console/page errors: " + (errors.length === 0 ? "NONE" : String(errors.length)));
    for (const e of errors) append("  " + e);
    ok = ok && errors.length === 0;
    return ok;
  };
  ok = await main();
} catch (e) {
  append("CHECK-FAILED: " + String(e?.message || e).slice(0, 300));
  ok = false;
} finally {
  await browser.close();
}
append("GH-VERIFY-" + (ok ? "PASS" : "FAIL"));
process.exit(ok ? 0 : 1);