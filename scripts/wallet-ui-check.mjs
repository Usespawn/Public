// Wallet UI readiness check (headless, read-only, NO transactions).
// Verifies: Mainnet badge, wallet modal contents, disconnected-state UI,
// modal open/close round-trip. Extension flows require manual testing.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/wallet-ui-check.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));

  // 1. Launch page badge.
  await page.goto(BASE + "/launch", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(4_000);
  const launch = await page.locator("body").innerText();
  append("launch badge: " + (launch.match(/Solana (Mainnet|Devnet|Localnet)/)?.[0] ?? "(none)"));
  append("launch disconnected-wallet state: " + (launch.includes("connect a wallet") || launch.includes("Select Wallet") || launch.includes("Choose image") ? "renders normally without a wallet" : "unexpected"));

  // 2. Wallet modal round-trip.
  const trigger = page.locator(".wallet-adapter-button-trigger").first();
  await trigger.waitFor({ state: "visible", timeout: 30_000 });
  await trigger.click();
  await page.waitForTimeout(2_000);
  const modal = await page.locator("body").innerText();
  append("modal lists Phantom: " + (modal.includes("Phantom") ? "YES" : "NO"));
  append("modal lists Solflare: " + (modal.includes("Solflare") ? "YES" : "NO"));
  // close via Escape, then verify the disconnected state is restored
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1_500);
  const after = await page.locator("body").innerText();
  append("modal closed (no Phantom text): " + (!after.includes("Connect a wallet on Solana") && !after.includes("wallet to use") ? "likely" : "check manually"));
  append("trigger restored: " + (await page.locator(".wallet-adapter-button-trigger").count() > 0 ? "YES" : "NO"));

  // 3. Portfolio disconnected state.
  await page.goto(BASE + "/portfolio", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(3_000);
  const pf = await page.locator("body").innerText();
  append("portfolio disconnected message: " + (pf.includes("Connect your wallet") ? "shown (graceful)" : "NOT FOUND"));
  append("portfolio badge: " + (pf.match(/Solana (Mainnet|Devnet|Localnet)/)?.[0] ?? "(none)"));

  append("console/page errors: " + (errors.length === 0 ? "NONE" : String(errors.length)));
  for (const e of errors) append("  " + e);
  append("WALLET-UI-CHECK-DONE");
} catch (e) {
  append("CHECK-FAILED: " + String(e?.message || e).slice(0, 300));
} finally {
  await browser.close();
}