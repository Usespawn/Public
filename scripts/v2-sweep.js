/**
 * One-shot V2 class sweep: maps legacy Tailwind grays/whites/old accents to
 * the SpawnPad Universe tokens across app/ and components/ *.tsx files.
 */
const fs = require("fs");
const path = require("path");

const ROOTS = [
  "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/app",
  "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/components",
];

const MAP = [
  ["bg-white text-black", "bg-acid text-obsidian"],
  ["hover:bg-zinc-200", "hover:bg-[#7DF0FF]"],
  ["hover:bg-white/10", "hover:bg-raised/60"],
  ["disabled:bg-white/10", "disabled:bg-raised/60"],
  ["disabled:text-zinc-500", "disabled:text-faint"],
  ["bg-white/10", "bg-raised/60"],
  ["bg-white/5", "bg-raised/50"],
  ["bg-zinc-900/60", "bg-raised/60"],
  ["bg-zinc-900", "bg-raised"],
  ["border-white/20", "border-line-strong"],
  ["border-white/10", "border-line"],
  ["hover:border-white/20", "hover:border-line-strong"],
  ["bg-white/15", "bg-raised"],
  ["hover:bg-white/5", "hover:bg-raised/50"],
  ["text-amber-400", "text-warn"],
  ["border-amber-500/30", "border-warn/40"],
  ["bg-amber-500/10", "bg-warn/10"],
  ["text-amber-500", "text-warn"],
  ["text-red-400", "text-crimson"],
  ["text-red-500", "text-crimson"],
  ["bg-red-500/20", "bg-crimson/20"],
  ["bg-red-500/10", "bg-crimson/10"],
  ["border-red-500/30", "border-crimson/40"],
  ["border-red-500/40", "border-crimson/50"],
  ["text-zinc-100", "text-ink"],
  ["text-zinc-200", "text-ink"],
  ["text-zinc-300", "text-muted"],
  ["text-zinc-400", "text-muted"],
  ["text-zinc-500", "text-faint"],
  ["text-zinc-600", "text-faint"],
  ["text-zinc-700", "text-faint"],
  ["hover:text-white", "hover:text-ink"],
  ["text-white", "text-ink"],
  ["text-black", "text-obsidian"],
  ["-mint/", "-acid/"],
  ["text-mint", "text-acid"],
  ["bg-mint", "bg-acid"],
  ["border-mint", "border-acid"],
];

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

let touched = 0;
for (const file of ROOTS.flatMap(walk)) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  for (const [from, to] of MAP) src = src.split(from).join(to);
  if (src !== before) {
    fs.writeFileSync(file, src);
    touched++;
    console.log("swept", file);
  }
}
console.log("V2-SWEEP-DONE touched=" + touched);
