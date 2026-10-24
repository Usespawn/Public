// Retry CSS: hit page twice, then re-check css
const fs = require("fs");
(async () => {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const r = await fetch("http://127.0.0.1:3000/");
    const h = await r.text();
    const css = [...h.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)].map((m) => m[1])[0];
    let st = "n/a";
    if (css) {
      const cr = await fetch("http://127.0.0.1:3000" + css);
      st = cr.status + " len=" + (await cr.text()).length;
    }
    out.push(`attempt ${i}: page=${r.status} css=${css || "none"} -> ${st}`);
    await new Promise((res) => setTimeout(res, 3000));
  }
  fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/css-retry.log", out.join("\n") + "\nCSS-RETRY-DONE");
})().catch((e) => {
  fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/css-retry.log", "FATAL " + e.stack + "\nCSS-RETRY-DONE");
});


