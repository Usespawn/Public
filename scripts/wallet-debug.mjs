/**
 * Debug: inspect the Wallet-Standard registry state inside the live page.
 */
import { chromium } from "playwright";
import { appendFileSync } from "fs";

const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/wallet-debug.log";
appendFileSync(LOG, `=== DEBUG ${new Date().toISOString()} ===\n`);
const log = (s) => { appendFileSync(LOG, s + "\n"); console.log(s); };

const INJECT = `
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
  });
  window.navigator.wallets = window.navigator.wallets || [];
  window.__mockPushHappened = true;
  window.navigator.wallets.push(function (api) {
    window.__mockCallbackRan = true;
    window.__mockApiKeys = Object.keys(api || {});
    api.register(mk("MetaMask"));
    api.register(mk("Backpack"));
  });
})();
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(INJECT);
await page.goto("http://127.0.0.1:3000/", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(5000);

const state = await page.evaluate(() => {
  const w = window.navigator.wallets;
  return {
    mockPushHappened: window.__mockPushHappened,
    mockCallbackRan: window.__mockCallbackRan,
    mockApiKeys: window.__mockApiKeys,
    walletsType: typeof w,
    walletsIsFrozen: w ? Object.isFrozen(w) : null,
    walletsKeys: w ? Object.keys(w) : null,
    solana: typeof window.solana,
  };
});
log(`[state] ${JSON.stringify(state)}`);

await browser.close();
log("DEBUG-DONE");