import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/screens";
mkdirSync(OUT, { recursive: true });

const shots = [
  ["live-home.png", "http://localhost:3000/", 1440, 900],
  ["live-brand.png", "http://localhost:3000/brand", 1440, 900],
  ["live-nav.png", "http://localhost:3000/", 1440, 900, true],
];

console.log("LIVE-SHOTS-START");
const browser = await chromium.launch();
for (const [file, url, width, height, clipNav] of shots) {
  try {
    console.log(`shot ${file}`);
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(2500);
    if (clipNav) {
      await page.screenshot({ path: `${OUT}/${file}`, clip: { x: 0, y: 0, width, height: 120 } });
    } else {
      await page.screenshot({ path: `${OUT}/${file}` });
    }
    await page.close();
    console.log(`${file} -> ok`);
  } catch (e) {
    console.log(`${file} -> FAIL ${e.message}`);
  }
}
await browser.close();
console.log("LIVE-SHOTS-OK");
