// Clean-context reproduction: bundled chromium has NO extensions.
// Captures console errors, page errors, and unhandled rejections separately,
// and reports which wallet provider globals exist on the page.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/metamask-repro.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const consoleErrors = [], pageErrors = [], rejections = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => pageErrors.push(String(e?.message || e).slice(0, 200)));
  await page.exposeFunction("__onReject", (msg) => rejections.push(msg.slice(0, 200)));
  await page.addInitScript(`
    window.addEventListener("unhandledrejection", (e) => window.__onReject(String(e?.reason?.message || e?.reason || "unknown rejection")));
  `);

  for (const path of ["/", "/launch", "/portfolio"]) {
    consoleErrors.length = 0; pageErrors.length = 0; rejections.length = 0;
    try {
      await page.goto("http://127.0.0.1:3000" + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(4_000);
    } catch (e) {
      append(`${path}: GOTO-FAILED ${String(e?.message || e).slice(0, 120)}`);
      continue;
    }
    const providers = await page.evaluate(() => ({
      ethereum: typeof window.ethereum,
      isMetaMask: window.ethereum?.isMetaMask ?? null,
      solana: typeof window.solana,
      phantom: typeof window.phantom,
      solflare: typeof window.solflare,
      metamaskGlobal: typeof window.metamask,
    }));
    append(`${path}: providers=${JSON.stringify(providers)}`);
    append(`${path}: consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length} unhandledRejections=${rejections.length}`);
    for (const e of [...new Set([...consoleErrors, ...pageErrors, ...rejections])].slice(0, 6)) {
      append(`   ${e}`);
    }
    append(`${path}: metamask-error-present: ${[...consoleErrors, ...pageErrors, ...rejections].some((s) => /metamask/i.test(s)) ? "YES (BAD)" : "NO"}`);
  }
  append("METAMASK-REPRO-DONE");
} finally {
  await browser.close();
}