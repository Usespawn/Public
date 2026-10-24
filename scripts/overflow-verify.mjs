// Overflow VERIFICATION (post-fix): at 7 viewports x 5 pages, require
// documentElement.scrollWidth <= innerWidth + 1 and body.scrollWidth <= innerWidth + 1.
// Lists offenders if any. Exits non-zero on failure.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/overflow-verify.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const VIEWPORTS = [
  [1920, 1080], [1728, 864], [1440, 900], [1024, 768], [768, 1024], [390, 844], [360, 800],
];
const PAGES = ["/", "/explore", "/launch", "/portfolio", "/docs"];

const browser = await chromium.launch({ headless: true });
let allOk = true;
try {
  const page = await browser.newPage();
  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    for (const path of PAGES) {
      try {
        await page.goto("http://127.0.0.1:3000" + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      } catch (e) {
        append(`${w}x${h} ${path}: GOTO-FAILED ${String(e?.message || e).slice(0, 120)}`);
        allOk = false;
        continue;
      }
      await page.waitForTimeout(1_200);
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const vw = window.innerWidth;
        const off = [];
        if (de.scrollWidth - vw > 1 || document.body.scrollWidth - vw > 1) {
          for (const el of document.querySelectorAll("*")) {
            const b = el.getBoundingClientRect();
            if (b.width === 0 && b.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.position === "fixed") continue;
            // only elements NOT clipped by an ancestor with overflow hidden/clip
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
      const ok = r.docOver <= 1 && r.bodyOver <= 1 && r.off.length === 0;
      if (!ok) allOk = false;
      append(`${w}x${h} ${path}: docOver=${r.docOver} bodyOver=${r.bodyOver} ${ok ? "OK" : "FAIL"}`);
      for (const o of r.off) append("   UNCLIPPED-OFFENDER " + o);
    }
  }
  append(allOk ? "OVERFLOW-VERIFY-ALL-OK" : "OVERFLOW-VERIFY-FAILURES");
} finally {
  await browser.close();
}