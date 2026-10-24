// Video-production environment audit. Writes results to vid-env-check.txt
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/vid-env-check.txt";
fs.writeFileSync(LOG, "");
const out = (s) => fs.appendFileSync(LOG, s + "\n");

function which(name) {
  try { const r = cp.execSync(`where ${name}`, { encoding: "utf8", timeout: 15000 }); return r.trim().split(/\r?\n/)[0]; }
  catch { return null; }
}

out("node " + process.version);
out("ffmpeg: " + (which("ffmpeg") || "NOT FOUND"));
out("ffprobe: " + (which("ffprobe") || "NOT FOUND"));
out("SAPI speech dir: " + fs.existsSync("C:/Windows/System32/Speech"));

const web = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";
for (const m of ["playwright", "@playwright/test", "remotion", "next", "react"]) {
  try { out(m + " " + require(path.join(web, "node_modules", m, "package.json")).version); }
  catch { out(m + " NOT INSTALLED"); }
}

const pbDir = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
out("ms-playwright browsers: " + (fs.existsSync(pbDir) ? fs.readdirSync(pbDir).join(", ") : "NOT FOUND"));
out("System Chrome: " + fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe") || fs.existsSync(path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")));
out("System Edge: " + fs.existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"));

try { out("scripts/: " + fs.readdirSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/scripts").join(", ")); } catch (e) { out("scripts/: " + e.message); }
try { out("marketing/: " + fs.readdirSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/marketing").join(", ")); } catch (e) { out("marketing/: " + e.message); }
try { out("marketing/spawnpad-tutorial/: " + fs.readdirSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/marketing/spawnpad-tutorial").join(", ")); } catch (e) { out("marketing/spawnpad-tutorial/: " + e.message); }

const http = require("http");
const done = () => out("VID-ENV-CHECK-DONE");
http.get("http://localhost:3000/", (res) => { out("localhost:3000 -> HTTP " + res.statusCode); res.resume(); done(); })
  .on("error", (e) => { out("localhost:3000 -> ERROR " + e.message); done(); });
setTimeout(() => { out("localhost:3000 -> TIMEOUT"); done(); }, 8000);