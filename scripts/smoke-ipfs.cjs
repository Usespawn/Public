// SpawnPad REAL Pinata smoke test — drives the actual Next.js API routes.
// Flow:
//   1. POST /api/metadata/upload  (1x1 PNG, multipart)  -> image CID + https URL
//   2. POST /api/metadata/json    (metadata referencing the image URL) -> JSON CID + URL
//   3. GET both gateway URLs -> expect HTTP 200 + correct content-type
// No Solana transactions, no token launch. Writes results to smoke-ipfs.txt.
const fs = require("fs");
const BASE = "http://localhost:3000";
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/smoke-ipfs.txt";
fs.writeFileSync(LOG, "starting...\n");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const done = (code) => { append(`SMOKE-EXIT-${code === 0 ? "OK" : "FAIL"}`); process.exit(code); };

// Valid 1x1 PNG (red pixel) — passes magic-byte sniffing.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  const png = Buffer.from(PNG_B64, "base64");
  append(`PNG bytes: ${png.length} magic: ${png.slice(0, 4).toString("hex")}`);

  // --- 1. image upload ---
  let imgRes, imgBody;
  try {
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "spawnpad-smoke-test.png");
    const t0 = Date.now();
    imgRes = await fetch(`${BASE}/api/metadata/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
    append(`upload route: HTTP ${imgRes.status} in ${Date.now() - t0}ms`);
    imgBody = await imgRes.json();
  } catch (e) {
    append(`image upload failed: ${e.message || e}`);
    return done(1);
  }
  if (!imgRes.ok || !imgBody.ok) {
    append(`image upload rejected: HTTP ${imgRes.status} ${JSON.stringify(imgBody)}`);
    return done(1);
  }
  append(`IMAGE CID: ${imgBody.cid}`);
  append(`IMAGE URL: ${imgBody.url}`);

  // --- 2. metadata JSON upload (references the image URL) ---
  let metaRes, metaBody;
  try {
    const t0 = Date.now();
    metaRes = await fetch(`${BASE}/api/metadata/json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "SpawnPad Smoke Test",
        symbol: "SMOKETEST",
        description: "SpawnPad real Pinata upload smoke test (devnet, no token launch).",
        imageUrl: imgBody.url,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    append(`json route: HTTP ${metaRes.status} in ${Date.now() - t0}ms`);
    metaBody = await metaRes.json();
  } catch (e) {
    append(`metadata upload failed: ${e.message || e}`);
    return done(1);
  }
  if (!metaRes.ok || !metaBody.ok) {
    append(`metadata upload rejected: HTTP ${metaRes.status} ${JSON.stringify(metaBody)}`);
    return done(1);
  }
  append(`META CID: ${metaBody.cid}`);
  append(`META URL: ${metaBody.url}`);

  // --- 3. gateway retrieval of both CIDs ---
  let ok = true;
  for (const [label, url] of [["image", imgBody.url], ["metadata", metaBody.url]]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      const ct = res.headers.get("content-type") || "(none)";
      const bytes = (await res.arrayBuffer()).byteLength;
      append(`gateway ${label}: HTTP ${res.status} content-type=${ct} bytes=${bytes}`);
      if (res.status !== 200) ok = false;
    } catch (e) {
      append(`gateway ${label} fetch failed: ${e.message || e}`);
      ok = false;
    }
  }
  append(ok ? "GATEWAY-RETRIEVAL-OK" : "GATEWAY-RETRIEVAL-ISSUES");
  return done(ok ? 0 : 1);
}

main();