// Fetch homepage, extract CSS URL, retry until CSS returns 200 (writes incrementally)
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/css-retry2.log";
fs.writeFileSync(LOG, "");
const append = (line) => fs.appendFileSync(LOG, line + "\n");
(async () => {
  for (let i = 0; i < 4; i++) {
    const r = await fetch("http://127.0.0.1:3000/");
    const h = await r.text();
    append(`attempt ${i + 1}: page=${r.status}`);
    const m = h.match(/href="(\/_next\/static\/css\/[^"]+)"/);
    if (m) {
      const c = await fetch("http://127.0.0.1:3000" + m[1]);
      const t = await c.text();
      append(`  css=${m[1]} -> ${c.status} len=${t.length}`);
      if (c.status === 200) break;
    } else {
      append("  no css link in html");
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  append("CSS-RETRY-DONE");
})().catch((e) => {
  append("FATAL " + e.message);
  append("CSS-RETRY-DONE");
});