/** Headless-Chrome screenshot pass over the live dev server (desktop + mobile). */
const { spawnSync } = require("child_process");
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/site-shots.log";
const DIR = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/shots";
const wlog = (s) => fs.appendFileSync(LOG, s + "\n");
try {
  fs.writeFileSync(LOG, "SITE-SHOTS-START\n");
  fs.mkdirSync(DIR, { recursive: true });
  const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const JOBS = [
    ["home-desktop.png", "http://localhost:3000/", 1440, 2400],
    ["home-mobile.png", "http://localhost:3000/", 390, 2200],
    ["launch-desktop.png", "http://localhost:3000/launch", 1440, 1600],
    ["explore-desktop.png", "http://localhost:3000/explore", 1440, 1600],
    ["docs-desktop.png", "http://localhost:3000/docs", 1440, 1600],
  ];
  for (const [out, url, w, h] of JOBS) {
    wlog("shot " + out);
    const r = spawnSync(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--hide-scrollbars",
        `--window-size=${w},${h}`,
        `--screenshot=${DIR}/${out}`,
        url,
      ],
      { stdio: "ignore", timeout: 240000 }
    );
    let info = r.status === 0 ? "ok" : "exit=" + r.status;
    try {
      info += ` ${fs.readFileSync(`${DIR}/${out}`).length}B`;
    } catch {
      info += " NO-FILE";
    }
    wlog(out + " -> " + info);
  }
  wlog("SITE-SHOTS-DONE");
  console.log("SITE-SHOTS-DONE");
} catch (e) {
  wlog("FATAL " + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
}