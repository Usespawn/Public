/**
 * Opens the Connect-Wallet modal, lists every wallet shown (Popular /
 * Detected / More sections) and screenshots the modal.
 * Usage: node scripts/wallet-modal-inspect.mjs [url]
 */
import { chromium } from "playwright";
import { appendFileSync } from "fs";

const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/wallet-modal.log";
appendFileSync(LOG, `=== WALLET MODAL ${new Date().toISOString()} ===\n`);
const log = (s) => {
  appendFileSync(LOG, s + "\n");
  console.log(s);
};

const URL = process.argv[2] || "http://127.0.0.1:3000/";
const MOCK = process.env.MOCK === "1";

/** Minimal Wallet-Standard registration, injected before app scripts run. */
const MOCK_INJECT = `
(() => {
  const icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  const mk = (name) => ({
    name,
    version: "1.0.0",
    icon,
    chains: ["solana:mainnet", "solana:devnet"],
    accounts: [],
    features: {
      "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [] }) },
      "standard:events": { version: "1.0.0", on: () => () => {}, off: () => {} },
      "standard:disconnect": { version: "1.0.0", disconnect: async () => {} },
      "solana:signTransaction": { version: "1.0.0", signTransaction: async () => { throw new Error("mock"); } },
    },
    connect: async () => ({ accounts: [] }),
    on: () => () => {},
  });
  window.navigator.wallets = window.navigator.wallets || [];
  window.navigator.wallets.push(function (api) {
    api.register(mk("MetaMask"));
    api.register(mk("Backpack"));
  });
})();
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
if (MOCK) {
  await page.addInitScript(MOCK_INJECT);
  log("mock MetaMask + Backpack wallets injected (simulating user browser)");
}
await page.goto(URL, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(4000);

// Trigger can be the real WalletMultiButton or the mount-gate placeholder.
const trigger = page.locator(".wallet-adapter-button-trigger").first();
await trigger.waitFor({ state: "visible", timeout: 15000 });
await trigger.click();
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const modal = document.querySelector(".wallet-adapter-modal");
  if (!modal) return { open: false };
  const items = Array.from(document.querySelectorAll(".wallet-adapter-modal-list li"));
  const wallets = items.map((li) => {
    const name = li.querySelector(".wallet-adapter-modal-list-more, span, button")?.textContent?.trim();
    const cls = li.className;
    return { name, cls };
  });
  const sections = Array.from(document.querySelectorAll(".wallet-adapter-modal-list-more, .wallet-adapter-modal-middle")).map(
    (e) => e.textContent?.trim()
  );
  const bodyText = modal.textContent || "";
  return {
    open: true,
    count: items.length,
    wallets,
    hasMetaMask: /metamask/i.test(bodyText),
    sectionsHint: sections.slice(0, 3),
    textSnippet: bodyText.replace(/\s+/g, " ").slice(0, 400),
  };
});
log(`[modal] ${JSON.stringify(info, null, 1)}`);
await page.screenshot({ path: "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/brand/wallet-modal.png" });
log("modal shot saved");

await browser.close();
log("WALLET-MODAL-DONE");