/**
 * SpawnPad logo asset generator — "spawn trajectory" emblem.
 * Emits all brand SVGs + the app favicon from a single geometry template.
 * Run: node scripts/make-logo-assets.js
 */
const fs = require("fs");

const BRAND = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/brand/svg";
const APP = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/app";
fs.mkdirSync(BRAND, { recursive: true });

/** Trajectory geometry (viewBox 0 0 100 224). */
const BANDS = [
  "M57.5 169 L76 154 L24 70 L42.9 54.6",
  "M15.1 203.5 L44.2 179.8",
  "M56.1 43.9 L84.9 20.5",
];
const NIBS = ["M99 1 L91 27 L97 54 L79 34 L66 24 L74 9 Z", "M1 223 L9 197 L3 170 L21 178 L34 200 L26 215 Z"];
const NODES = [
  { cx: 49.5, cy: 49.3, r: 8.5 },
  { cx: 51, cy: 174, r: 8.5 },
];

function trajectoryBody(strokeRef, fillRef, nodeFill) {
  const bands = BANDS.map(
    (d) => `    <path d="${d}" stroke="${strokeRef}" stroke-width="14" fill="none" stroke-linejoin="round"/>`
  ).join("\n");
  const nibs = NIBS.map((d) => `    <path d="${d}" fill="${fillRef}"/>`).join("\n");
  const nodes = NODES.map(
    (n) => `    <circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" stroke="${strokeRef}" stroke-width="3.5" fill="${nodeFill}"/>`
  ).join("\n");
  return `${bands}\n${nibs}\n${nodes}`;
}

const GRAD = (id) => `  <linearGradient id="${id}" x1="95" y1="5" x2="15" y2="215" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#2BE5FF"/>
    <stop offset="0.38" stop-color="#4E86FF"/>
    <stop offset="0.68" stop-color="#8B5CF6"/>
    <stop offset="1" stop-color="#E73BD6"/>
  </linearGradient>`;

/** Wordmark: Spawn (inkColor) + Pad (padRef). Local space 0..326 × 0..72. */
function wordmark(inkColor, padRef) {
  const P = [
    ["M29 13 C29 8 24 6 16 6 C8 6 3 10 3 17 C3 24 8 27 16 29 C24 31 29 34 29 41 C29 48 24 52 16 52 C8 52 3 49 3 44", 0],
    ["M45 24 C49 19 55 17 60 17 C68 17 73 23 73 33 C73 43 68 50 60 50 C55 50 49 48 45 44", 0],
    ["M45 14 L45 64", 0],
    ["M107 24 C104 20 100 18 95 18 C88 18 84 24 84 34 C84 44 88 50 95 50 C100 50 104 48 107 44", 0],
    ["M107 18 L107 50", 0],
    ["M122 18 L130 50 L140 27 L150 50 L158 18", 0],
    ["M173 18 L173 50", 0],
    ["M173 28 C176 21 181 18 186 18 C193 18 197 23 197 31 L197 50", 0],
    ["M213 52 L213 6 L228 6 C236 6 240 11 240 19 C240 27 236 32 228 32 L213 32", 1],
    ["M275 24 C272 20 268 18 263 18 C256 18 252 24 252 34 C252 44 256 50 263 50 C268 50 272 48 275 44", 1],
    ["M275 18 L275 50", 1],
    ["M315 24 C312 20 308 18 303 18 C296 18 292 24 292 34 C292 44 296 50 303 50 C308 50 312 48 315 44", 1],
    ["M315 6 L315 50", 1],
  ];
  return P.map(
    ([d, pad]) =>
      `    <path d="${d}" stroke="${pad ? padRef : inkColor}" stroke-width="7" stroke-linecap="round"${d.includes("L130") ? ' stroke-linejoin="round"' : ""}${d.startsWith("M213") ? ' stroke-linejoin="round"' : ""}/>`
  ).join("\n");
}

const files = {};

/** 1. Gradient emblem (transparent). */
files[`${BRAND}/spawnpad-emblem-gradient.svg`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 224" fill="none">
  <!-- SpawnPad emblem — the spawn trajectory -->
  <defs>
${GRAD("traj")}
  </defs>
${trajectoryBody("url(#traj)", "url(#traj)", "none")}
</svg>
`;

/** 2-3. Monochrome emblems. */
for (const [name, color] of [
  ["spawnpad-emblem-mono-white", "#F4F7FF"],
  ["spawnpad-emblem-mono-black", "#0B1124"],
  ["spawnpad-emblem-mono", "currentColor"],
]) {
  files[`${BRAND}/${name}.svg`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 224" fill="none">
  <!-- SpawnPad emblem — monochrome (${color}) -->
${trajectoryBody(color, color, "none")}
</svg>
`;
}

/** 4. App icon tile (midnight). */
files[`${BRAND}/spawnpad-icon-tile.svg`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <!-- SpawnPad app icon — trajectory emblem on a midnight tile -->
  <defs>
${GRAD("tileTraj")}
    <linearGradient id="tileBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#101A35"/>
      <stop offset="1" stop-color="#0B1124"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="22" fill="url(#tileBg)"/>
  <g transform="translate(32 12) scale(0.3214)">
${trajectoryBody("url(#tileTraj)", "url(#tileTraj)", "none")}
  </g>
</svg>
`;

/** 5-6. Primary lockups (dark + light). */
for (const [name, ink, bgNote] of [
  ["spawnpad-logo-dark", "#F4F7FF", "dark backgrounds"],
  ["spawnpad-logo-light", "#0B1124", "light surfaces"],
]) {
  files[`${BRAND}/${name}.svg`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 262 96" fill="none">
  <!-- SpawnPad primary logo — emblem + wordmark for ${bgNote} -->
  <defs>
${GRAD("lockTraj")}
    <linearGradient id="lockPad" x1="212" y1="0" x2="318" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#42E8FF"/>
      <stop offset="1" stop-color="#9670FF"/>
    </linearGradient>
  </defs>
  <g transform="scale(0.4286)">
${trajectoryBody("url(#lockTraj)", "url(#lockTraj)", "none")}
  </g>
  <g transform="translate(62 20) scale(0.6)" stroke-width="7" stroke-linecap="round">
${wordmark(ink, "url(#lockPad)")}
  </g>
</svg>
`;
}

for (const [path, content] of Object.entries(files)) {
  fs.writeFileSync(path, content);
  console.log("wrote", path.split("spawnpad/")[1]);
}

/** 7. App favicon (same as icon tile). */
fs.copyFileSync(`${BRAND}/spawnpad-icon-tile.svg`, `${APP}/icon.svg`);
console.log("wrote web/app/icon.svg");
console.log("LOGO-ASSETS-DONE");
