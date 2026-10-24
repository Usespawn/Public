// Demo token art for the tutorial upload step (512x512, clearly labeled).
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/marketing/spawnpad-tutorial/assets/demo-token-art.png";
fs.mkdirSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/marketing/spawnpad-tutorial/assets", { recursive: true });
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}
body{width:512px;height:512px;overflow:hidden;position:relative;font-family:Inter,sans-serif;
  background:
   radial-gradient(420px 420px at 70% 20%, rgba(150,112,255,.35), transparent 60%),
   radial-gradient(400px 380px at 20% 85%, rgba(66,232,255,.28), transparent 60%),
   linear-gradient(160deg,#101A35,#0B1124 70%);
  color:#F4F7FF}
.frame{position:absolute;inset:22px;border:2px solid rgba(66,232,255,.35);border-radius:18px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.s{font-family:"Space Grotesk",sans-serif;font-size:150px;font-weight:700;line-height:1;
  background:linear-gradient(135deg,#42E8FF,#9670FF);-webkit-background-clip:text;background-clip:text;color:transparent;
  text-shadow:0 0 60px rgba(66,232,255,.35)}
.name{font-family:"Space Grotesk",sans-serif;font-size:34px;font-weight:700;margin-top:18px;letter-spacing:.04em}
.sym{font-family:"JetBrains Mono",monospace;font-size:22px;color:#42E8FF;margin-top:10px;letter-spacing:.3em}
.demo{position:absolute;bottom:34px;font-family:"JetBrains Mono",monospace;font-size:14px;
  letter-spacing:.22em;color:#FFC857;border:1px solid rgba(255,200,87,.5);border-radius:999px;padding:8px 18px;
  background:rgba(255,200,87,.08)}
.grid{position:absolute;inset:0;pointer-events:none;opacity:.5;
  background:repeating-linear-gradient(0deg,rgba(41,59,96,.2) 0 1px,transparent 1px 48px),
  repeating-linear-gradient(90deg,rgba(41,59,96,.2) 0 1px,transparent 1px 48px)}
</style></head><body>
<div class="grid"></div>
<div class="frame">
  <div class="s">S</div>
  <div class="name">Spawn Tutorial Token</div>
  <div class="sym">SPAWNDEMO</div>
  <div class="demo">DEMO ARTWORK — NOT A REAL TOKEN</div>
</div>
</body></html>`;
const H = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/marketing/spawnpad-tutorial/assets/demo-art.html";
fs.writeFileSync(H, html);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.goto("file:///" + H.replace(/\\/g, "/"), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT });
  console.log("demo art written: " + OUT);
} finally { await browser.close(); }