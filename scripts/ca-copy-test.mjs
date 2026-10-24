// Copy-path E2E: temporarily substitute a TEST address for
// SPAWN_OFFICIAL_TOKEN_CA, verify the chip copies the COMPLETE address and
// shows "Copied!", then RESTORE lib/config.ts byte-identical (SHA-256 check)
// in a finally block — the official constant is never left changed.
import { chromium } from "playwright";
import fs from "node:fs";
import crypto from "node:crypto";
const BASE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const CONFIG = BASE + "/web/lib/config.ts";
const LOG = BASE + "/ca-copy-test.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const TEST_CA = "TESTCA".repeat(9).slice(0, 44); // 44-char test-only value
const original = fs.readFileSync(CONFIG, "utf8");
const originalHash = sha(CONFIG);
fs.writeFileSync(BASE + "/web/lib/config.ts.pre-copy-test", original);
append(`original sha256: ${originalHash}`);
append(`temp test CA: ${TEST_CA}`);

let browser = await chromium.launch({ headless: true });
let ok = false;
try {
  // Temporarily swap the constant (backup already written).
  fs.writeFileSync(CONFIG, original.replace(
    'export const SPAWN_OFFICIAL_TOKEN_CA = "TBA";',
    `export const SPAWN_OFFICIAL_TOKEN_CA = "${TEST_CA}";`
  ));
  if (!fs.readFileSync(CONFIG, "utf8").includes(TEST_CA)) throw new Error("temp substitution failed");

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  // HMR after the config edit recompiles broadly — wait up to 3 min for the
  // COPYABLE chip (aria-label swaps from "coming soon" to "Copy official …").
  const chip = page
    .locator('button[aria-label*="Copy official Spawn token CA"]')
    .first();
  await chip.waitFor({ state: "attached", timeout: 180_000 });
  await page.waitForTimeout(2_000);
  const before = (await chip.innerText()).replace(/\s+/g, " ").trim();
  append("chip text (real CA): " + JSON.stringify(before)); // expect "SPAWN CA TEST…TESTCA"-ish
  const title = await chip.getAttribute("title");
  append("chip title contains full CA: " + (title?.includes(TEST_CA) ? "YES" : "NO"));

  await chip.click();
  await page.waitForTimeout(500);
  const during = (await chip.innerText()).replace(/\s+/g, " ").trim();
  append("after click: " + JSON.stringify(during));
  ok = /Copied!/.test(during);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  append("clipboard content: " + JSON.stringify(clip));
  append("clipboard == COMPLETE test CA: " + (clip === TEST_CA ? "YES" : "NO"));
  ok = ok && clip === TEST_CA;
} catch (e) {
  append("COPY-TEST-ERROR: " + String(e?.message || e).slice(0, 250));
  ok = false;
} finally {
  // Restore byte-identical, regardless of outcome.
  try { await browser.close(); } catch {}
  fs.writeFileSync(CONFIG, original);
  const restoredHash = sha(CONFIG);
  append(`restored sha256: ${restoredHash}`);
  append(`byte-identical restore: ${restoredHash === originalHash ? "YES" : "NO"}`);
  fs.unlinkSync(BASE + "/lib/config.ts.pre-copy-test");
  append("CA-COPY-TEST-DONE " + (ok ? "PASS" : "FAIL"));
  process.exit(ok ? 0 : 1);
}