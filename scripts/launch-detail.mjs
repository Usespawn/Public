// Focused re-probe: /launch step-01 form — wait for real elements, not text.
import { chromium } from "playwright";
import fs from "node:fs";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/browser-launch-detail.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:3000/launch", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 60_000 });
  append("file input: ATTACHED");
  append("accept attr: " + (await fileInput.getAttribute("accept")));
  await page.waitForTimeout(5_000); // full hydration
  const labels = await page.locator("label").allInnerTexts();
  append("labels found: " + JSON.stringify(labels.slice(0, 10)));
  const body = await page.locator("body").innerText();
  append("body contains 'Token image': " + body.includes("Token image"));
  append("body contains 'PNG': " + body.includes("PNG"));
  append("badge: " + (body.match(/Solana (Mainnet|Devnet|Localnet)/)?.[0] ?? "(none)"));
  append("RECHECK-DONE");
} catch (e) {
  append("RECHECK-FAILED: " + String(e?.message || e).slice(0, 300));
} finally {
  await browser.close();
}