// Overflow diagnosis: at multiple viewports, find elements extending beyond
// the viewport (right > innerWidth or left < 0). Read-only. Logs offenders
// with tag/class/inline styles/size/position so fixes target root causes.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/overflow-diag.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const VIEWPORTS = [
  [1920, 1080], [1728, 864], [1440, 900], [1024, 768], [768, 1024], [390, 844], [360, 800],
];
const PAGES = ["/", "/explore", "/launch", "/portfolio", "/docs"];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).slice(0, 160)));

  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    for (const path of PAGES) {
      try {
        await page.goto("http://127.0.0.1:3000" + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      } catch (e) {
        append(`${w}x${h} ${path}: GOTO-FAILED ${String(e?.message || e).slice(0, 120)}`);
        continue;
      }
      await page.waitForTimeout(1_500);
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const vw = window.innerWidth;
        const docOver = de.scrollWidth - vw;
        const bodyOver = document.body.scrollWidth - vw;
        const offenders = [];
        if (docOver > 1 || bodyOver > 1) {
          for (const el of document.querySelectorAll("*")) {
            const b = el.getBoundingClientRect();
            if (b.width === 0 && b.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.position === "fixed") continue;
            if (b.right > vw + 1 || b.left < -1) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (typeof el.className === "string" ? el.className : "").slice(0, 120),
                id: el.id || undefined,
                left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width),
                pos: style.position, ovf: style.overflowX,
              });
            }
          }
          // dedupe + keep widest 12
          offenders.sort((a, b) => b.width - a.width);
        }
        return { vw, docOver, bodyOver, offenders: offenders.slice(0, 12) };
      });
      append(`${w}x${h} ${path}: docOver=${r.docOver} bodyOver=${r.bodyOver} offenders=${r.offenders.length}`);
      for (const o of r.offenders) {
        append(`   <${o.tag}${o.id ? "#" + o.id : ""} class="${o.cls}"> pos=${o.pos} ovfX=${o.ovf} left=${o.left} right=${o.right} w=${o.width}`);
      }
    }
  }
  append("console errors (" + consoleErrors.length + "):");
  for (const e of [...new Set(consoleErrors)].slice(0, 10)) append("  " + e);
  append("OVERFLOW-DIAG-DONE");
} finally {
  await browser.close();
}