import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/screens";
mkdirSync(OUT, { recursive: true });

const shots = [
  ["home-desktop.png", "http://localhost:3000/", 1440, 900, false],
  ["home-mobile.png", "http://localhost:3000/", 390, 844, true],
  ["launch-desktop.png", "http://localhost:3000/launch", 1440, 900, false],
  ["launch-mobile.png", "http://localhost:3000/launch", 390, 844, true],
  ["logo-desktop.png", "http://localhost:3000/logo", 1440, 900, false],
  ["docs-desktop.png", "http://localhost:3000/docs", 1440, 900, false],
  ["docs-mobile.png", "http://localhost:3000/docs", 390, 844, true],
];

console.log("SITE-SHOTS-START");
const browser = await chromium.launch();
for (const [file, url, width, height, mobile] of shots) {
  try {
    console.log(`shot ${file}`);
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: mobile,
      hasTouch: mobile,
    });
    // NOTE: use "load" — the app keeps wallet/RPC connections open so
    // "networkidle" never fires and the script hangs.
    await page.goto(url, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
    await page.close();
    console.log(`${file} -> ok`);
  } catch (e) {
    console.log(`${file} -> FAIL ${e.message}`);
  }
}
await browser.close();
console.log("SITE-SHOTS-OK");