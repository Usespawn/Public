/** Copy brand SVG assets into /public/brand for the brand page. */
const fs = require("fs");
const path = require("path");
const src = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/brand";
const dst = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/public/brand";
fs.mkdirSync(dst, { recursive: true });
const files = [
  "svg/spawnpad-logo-dark.svg",
  "svg/spawnpad-logo-light.svg",
  "svg/spawnpad-emblem-gradient.svg",
  "svg/spawnpad-emblem-mono-white.svg",
  "svg/spawnpad-emblem-mono-black.svg",
  "svg/spawnpad-icon-tile.svg",
  "svg/spawnpad-wordmark.svg",
  "png/spawnpad-logo-dark.png",
  "png/spawnpad-logo-light.png",
  "png/spawnpad-emblem-gradient.png",
  "png/spawnpad-emblem-mono-white.png",
  "png/spawnpad-emblem-mono-black.png",
  "png/spawnpad-wordmark.png",
  "png/spawnpad-icon-tile-512.png",
];
for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dst, path.basename(f)));
  console.log("copied", path.basename(f));
}
console.log("BRAND-COPY-DONE");
