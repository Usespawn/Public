// Headless browser readiness check (Playwright). Read-only UI verification:
// network badge, wallet button, launch form, settings page, console errors.
// Wallet EXTENSION flows (Phantom/Solflare popups) cannot run in headless
// Chromium — reported separately as code-inspected / untested.
import { chromium } from "playwright";
import fs from "node:fs";

const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/browser-check.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const BASE = "http://127.0.0.1:3000";

let browser = null;
const attempts = [{ headless: true }, { headless: true, channel: "chrome" }, { headless: true, channel: "msedge" }];
for (const opts of attempts) {
  try { browser = await chromium.launch(opts); append(`browser launched (${opts.channel || "bundled chromium"})`); break; }
  catch (e) { append(`launch failed (${opts.channel || "bundled"}): ${String(e?.message || e).slice(0, 120)}`); }
}
if (!browser) { append("BROWSER-UNAVAILABLE"); process.exit(1); }

const errors = [];
try {
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 180)); });
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 180)));

  // 1. Homepage — network badge + wallet button.
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(4_000); // hydration
  const home = await page.locator("body").innerText();
  const badge = home.match(/Solana (Mainnet|Devnet|Localnet)/);
  append(`home badge: ${badge ? badge[0] : "(badge text not found)"}`);
  append(`home wallet trigger: ${home.includes("Select Wallet") ? "present" : "NOT FOUND"}`);
  append(`home next-error marker: ${home.includes("__next_error__") || home.includes("Build Error") ? "YES (BAD)" : "no"}`);

  // 2. Launch page — step 01 form renders.
  await page.goto(BASE + "/launch", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(3_000);
  const launch = await page.locator("body").innerText();
  const badge2 = launch.match(/Solana (Mainnet|Devnet|Localnet)/);
  append(`launch badge: ${badge2 ? badge2[0] : "(not found)"}`);
  append(`launch form: name-field=${launch.includes("Token name") ? "ok" : "MISSING"} image-field=${launch.includes("Token image") ? "ok" : "MISSING"}`);
  append(`launch upload button before file selection: ${launch.includes("Upload to IPFS") ? "visible (unexpected — should appear only after choosing a file)" : "hidden (correct)"}`);
  append(`launch continue gating hint: ${launch.includes("Upload a token image to continue") ? "present" : "(not shown — expected while fields empty)"}`);

  // 3. Settings page — documents the network env contract.
  await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2_000);
  const settings = await page.locator("body").innerText();
  append(`settings mentions NEXT_PUBLIC_NETWORK: ${settings.includes("NEXT_PUBLIC_NETWORK") ? "yes" : "no"}`);

  // 4. Wallet modal opens (UI-level only; no extension can respond).
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2_000);
  const trigger = page.locator(".wallet-adapter-button-trigger").first();
  if (await trigger.count()) {
    await trigger.click();
    await page.waitForTimeout(1_500);
    const modal = await page.locator("body").innerText();
    append(`wallet modal: ${modal.includes("Phantom") ? "lists Phantom" : "phantom label not found"} / ${modal.includes("Solflare") ? "lists Solflare" : "solflare label not found"}`);
  } else {
    append("wallet modal: trigger not clickable (untested)");
  }

  append(`console/page errors: ${errors.length === 0 ? "NONE" : String(errors.length)}`);
  for (const e of errors) append("  " + e);
  append("BROWSER-CHECK-DONE");
} finally {
  await browser.close();
}