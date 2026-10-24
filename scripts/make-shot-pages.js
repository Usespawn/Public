/** Generate per-asset export pages for headless Chrome PNG shots (brand bg). */
const fs = require("fs");
const dir = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/brand/";
const pages = [
  // [page, svg, width, height, bg]
  ["shot-logo-dark.html", "svg/spawnpad-logo-dark.svg", 1288, 384, "#0B1124"],
  ["shot-logo-light.html", "svg/spawnpad-logo-light.svg", 1288, 384, "#F7F9FF"],
  ["shot-emblem.html", "svg/spawnpad-emblem-gradient.svg", 260, 582, "#0B1124"],
  ["shot-emblem-white.html", "svg/spawnpad-emblem-mono-white.svg", 260, 582, "#0B1124"],
  ["shot-emblem-black.html", "svg/spawnpad-emblem-mono-black.svg", 260, 582, "#F7F9FF"],
  ["shot-wordmark.html", "svg/spawnpad-wordmark.svg", 1304, 288, "#0B1124"],
  ["shot-icon.html", "svg/spawnpad-icon-tile.svg", 512, 512, "#0B1124"],
];
for (const [page, svg, w, h, bg] of pages) {
  fs.writeFileSync(
    dir + page,
    `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${bg}}img{display:block;width:${w}px;height:${h}px}</style></head><body><img src="${svg}"></body></html>`
  );
  console.log("page", page);
}
console.log("PAGES-DONE");
