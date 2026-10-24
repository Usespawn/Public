// Verify homepage loads, banner serves 200, no hydration errors
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/verify-home.log";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
(async () => {
  const out = [];
  // Homepage HTML
  const home = await fetch("http://127.0.0.1:3000/");
  const h = await home.text();
  out.push(`HOME status=${home.status} len=${h.length}`);
  out.push(`  has banner img tag: ${h.includes("/images/Spawnpad-banner.png")}`);
  out.push(`  raw <i> tags: ${(h.match(/<i[> ]/g) || []).length}`);
  out.push(`  next error marker: ${h.includes("__next_error__") || h.includes("Build Error")}`);
  out.push(`  mount-gate placeholder: ${h.includes("Select Wallet") && h.includes("wallet-adapter-button-trigger")}`);
  // Banner image
  const img = await fetch("http://127.0.0.1:3000/images/Spawnpad-banner.png");
  out.push(`BANNER status=${img.status} len=${(await img.arrayBuffer()).byteLength} ct=${img.headers.get("content-type")}`);
  // brand page still works
  const brand = await fetch("http://127.0.0.1:3000/brand");
  out.push(`BRAND status=${brand.status}`);
  out.push(`VERIFY-DONE`);
  fs.writeFileSync(LOG, out.join("\n"));
})().catch((e) => {
  fs.appendFileSync(LOG, "FATAL " + e.message + "\nVERIFY-DONE");
});