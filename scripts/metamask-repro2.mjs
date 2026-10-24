// Fresh extension-free reproduction with SEPARATE captures:
// console errors / page errors / unhandled rejections / FAILED REQUESTS,
// plus Next.js dev-overlay presence and provider globals.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/metamask-repro2.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let consoleErrors = [], pageErrors = [], rejections = [], failedReqs = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => pageErrors.push(String(e?.message || e).slice(0, 200)));
  page.on("requestfailed", (r) => failedReqs.push(`${r.failure()?.errorText}: ${r.url().slice(0, 120)}`));
  await page.exposeFunction("__onReject", (msg) => rejections.push(msg.slice(0, 200)));
  await page.addInitScript(`
    window.addEventListener("unhandledrejection", (e) => window.__onReject(String(e?.reason?.message || e?.reason || "unknown")));
  `);

  for (const path of ["/", "/launch"]) {
    consoleErrors.length = 0; pageErrors.length = 0; rejections.length = 0; failedReqs.length = 0;
    await page.goto("http://127.0.0.1:3000" + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(5_000);
    const dom = await page.evaluate(() => ({
      ethereum: typeof window.ethereum,
      isMetaMask: window.ethereum?.isMetaMask ?? null,
      overlay: !!document.querySelector("nextjs-portal"),
      bodyReady: document.body ? document.body.children.length > 0 : false,
    }));
    append(`${path}: window.ethereum=${dom.ethereum} isMetaMask=${dom.isMetaMask}`);
    append(`${path}: nextjs-portal (dev overlay) in DOM: ${dom.overlay ? "YES (dev overlay mounted)" : "no"}`);
    append(`${path}: consoleErrors=${consoleErrors.length} | pageErrors=${pageErrors.length} | unhandledRejections=${rejections.length} | failedRequests=${failedReqs.length}`);
    for (const s of [...new Set(consoleErrors)].slice(0, 4)) append(`   console: ${s}`);
    for (const s of [...new Set(pageErrors)].slice(0, 4)) append(`   pageerror: ${s}`);
    for (const s of [...new Set(rejections)].slice(0, 4)) append(`   rejection: ${s}`);
    for (const s of [...new Set(failedReqs)].slice(0, 4)) append(`   reqfail: ${s}`);
    append(`${path}: metamask-related error: ${[...consoleErrors, ...pageErrors, ...rejections].some((s) => /metamask/i.test(s)) ? "YES (BAD)" : "NO"}`);
  }
  append("METAMASK-REPRO2-DONE");
} finally {
  await browser.close();
}