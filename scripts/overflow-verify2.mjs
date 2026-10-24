// Overflow verification PART 2 (resumed): remaining viewports with per-page
// crash recovery — relaunches the browser after a renderer crash and retries
// the page once. Same pass criteria as part 1.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/overflow-verify2.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const JOBS = [
  [1024, 768, ["/launch", "/portfolio", "/docs"]],
  [768, 1024, ["/", "/explore", "/launch", "/portfolio", "/docs"]],
  [390, 844, ["/", "/explore", "/launch", "/portfolio", "/docs"]],
  [360, 800, ["/", "/explore", "/launch", "/portfolio", "/docs"]],
];

let browser = await chromium.launch({ headless: true });
let ctx = await browser.newContext();
let page = await ctx.newPage();
let allOk = true;

async function freshPage() {
  try { await ctx.close(); } catch {}
  try { await browser.close(); } catch {}
  browser = await chromium.launch({ headless: true });
  ctx = await browser.newContext();
  page = await ctx.newPage();
}

for (const [w, h, paths] of JOBS) {
  for (const path of paths) {
    let ok = false, result = null;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      try {
        await page.setViewportSize({ width: w, height: h });
        await page.goto("http://127.0.0.1:3000" + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(1_200);
        result = await page.evaluate(() => {
          const de = document.documentElement;
          const vw = window.innerWidth;
          const off = [];
          if (de.scrollWidth - vw > 1 || document.body.scrollWidth - vw > 1) {
            for (const el of document.querySelectorAll("*")) {
              const b = el.getBoundingClientRect();
              if (b.width === 0 && b.height === 0) continue;
              const style = getComputedStyle(el);
              if (style.position === "fixed") continue;
              let p = el.parentElement, clipped = false;
              while (p) {
                const ps = getComputedStyle(p);
                if (ps.overflowX === "hidden" || ps.overflowX === "clip") { clipped = true; break; }
                p = p.parentElement;
              }
              if (!clipped && (b.right > vw + 1 || b.left < -1)) {
                off.push(`<${el.tagName.toLowerCase()} class="${(typeof el.className === "string" ? el.className : "").slice(0, 110)}"> left=${Math.round(b.left)} right=${Math.round(b.right)}`);
              }
            }
          }
          return { docOver: de.scrollWidth - vw, bodyOver: document.body.scrollWidth - vw, off: off.slice(0, 8) };
        });
        ok = true;
      } catch (e) {
        append(`${w}x${h} ${path}: attempt ${attempt} error: ${String(e?.message || e).slice(0, 120)}`);
        await freshPage();
      }
    }
    if (ok && result) {
      const pass = result.docOver <= 1 && result.bodyOver <= 1 && result.off.length === 0;
      if (!pass) allOk = false;
      append(`${w}x${h} ${path}: docOver=${result.docOver} bodyOver=${result.bodyOver} ${pass ? "OK" : "FAIL"}`);
      for (const o of result.off) append("   UNCLIPPED-OFFENDER " + o);
    } else {
      allOk = false;
      append(`${w}x${h} ${path}: FAILED after retries`);
    }
  }
}
append(allOk ? "OVERFLOW-VERIFY2-ALL-OK" : "OVERFLOW-VERIFY2-FAILURES");
try { await browser.close(); } catch {}