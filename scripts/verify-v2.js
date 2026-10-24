/** Runtime verification: fetch key routes, check V2 markers, write log. */
const BASE = "http://127.0.0.1:3000";

const CHECKS = [
  ["/", [
    "SPAWNPAD // SOLANA LAUNCH SYSTEM",
    "EVERY TOKEN",
    "HAS AN",
    "MAKE YOURS.",
    "ENTER LAUNCHPAD",
    "EXPLORE TOKENS",
    "VANITY MINT CONSOLE".replace("VANITY MINT CONSOLE", "VANITY ENGINE"),
    "0B1124|0b1124",
    "GENERATE",
    "CONFIGURE",
    "LAUNCH",
    "Spw",
  ]],
  ["/explore", ["Explore", "verified", "Launch"]],
  ["/docs", ["DOCUMENTATION", "Spw", "create_v2", "devnet"]],
  ["/launch", ["Launch your token", "Spw", "Token information"]],
  ["/trending", ["Trending"]],
  ["/settings", ["Network", "Spw (mandatory)"]],
];

const cssChecks = ["42e8ff", "9670ff", "5885ff", "0b1124", "1a2b4d"];

(async () => {
  const out = [];
  for (const [route, needles] of CHECKS) {
    try {
      const r = await fetch(BASE + route);
      const h = (await r.text()).toLowerCase();
      const res = needles.map((n) => {
        const parts = n.toLowerCase().split("|");
        return `${n}: ${parts.some((p) => h.includes(p.toLowerCase())) ? "OK" : "MISS"}`;
      });
      out.push(`GET ${route} -> ${r.status}\n  ` + res.join("\n  "));
    } catch (e) {
      out.push(`GET ${route} -> ERROR ${e.message}`);
    }
  }
  // Verify compiled CSS carries the V2 palette
  try {
    const home = await fetch(BASE + "/");
    const html = await home.text();
    const cssLinks = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((m) => m[1]);
    out.push(`css files: ${cssLinks.length}`);
    for (const c of cssLinks) {
      const css = await (await fetch(BASE + c)).text();
      const found = cssChecks.filter((x) => css.includes(x));
      out.push(`  ${c}: palette ${found.length}/${cssChecks.length} (${found.join(",")})`);
    }
  } catch (e) {
    out.push("css check failed: " + e.message);
  }
  require("fs").writeFileSync(
    "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/verify-v2.log",
    "V2-VERIFY\n" + out.join("\n")
  );
  console.log("V2-VERIFY-WRITTEN");
})();
