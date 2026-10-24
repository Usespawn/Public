/** PNG exporter — one chrome run per asset, RGBA check. Instrumented. */
const { spawnSync } = require("child_process");
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/png-export.log";
const wlog = (s) => fs.appendFileSync(LOG, s + "\n");
try {
  fs.writeFileSync(LOG, "SCRIPT-START\n");
  const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const BRAND = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/brand";
  const PNG = BRAND + "/png";
  fs.mkdirSync(PNG, { recursive: true });

  const JOBS = [
    ["spawnpad-logo-dark.png", "shot-logo-dark.html", 1288, 384],
    ["spawnpad-logo-light.png", "shot-logo-light.html", 1288, 384],
    ["spawnpad-emblem-gradient.png", "shot-emblem.html", 260, 582],
    ["spawnpad-emblem-mono-white.png", "shot-emblem-white.html", 260, 582],
    ["spawnpad-emblem-mono-black.png", "shot-emblem-black.html", 260, 582],
    ["spawnpad-wordmark.png", "shot-wordmark.html", 1304, 288],
    ["spawnpad-icon-tile-512.png", "shot-icon.html", 512, 512],
  ];

  for (const [out, page, w, h] of JOBS) {
    wlog("spawn " + out);
    const r = spawnSync(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--disable-sync",
        `--window-size=${w},${h}`,
        `--screenshot=${PNG}/${out}`,
        `file:///${BRAND}/${page}`,
      ],
      { stdio: "ignore", timeout: 90000 }
    );
    let info = r.status === 0 ? "ok" : "exit=" + r.status + (r.error ? " err=" + r.error.code : "");
    try {
      const b = fs.readFileSync(`${PNG}/${out}`);
      info += ` ${b.length}B colorType=${b[25]}${b[25] === 6 ? "(RGBA)" : "(RGB)"}`;
    } catch {
      info += " NO-FILE";
    }
    wlog(out + " -> " + info);
  }
  wlog("PNG-EXPORT-DONE");
  console.log("PNG-EXPORT-DONE");
} catch (e) {
  wlog("FATAL " + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
}
