// Playground smoke test: grind → create → buy → sell → state.
const BASE = "http://127.0.0.1:3000";
async function api(path, body) {
  const r = await fetch(BASE + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const d = await r.json();
  if (!d.ok) throw new Error(path + " → " + (d.error || r.statusText));
  return d;
}
(async () => {
  const bal = await api("/api/balance");
  console.log("balance:", bal.balance / 1e9, "SOL wallet", bal.wallet);

  const html = await (await fetch(BASE + "/")).text();
  console.log("ui bytes:", html.length);

  const g = await api("/api/grind", {});
  console.log("grinded:", g.publicKey, "attempts", g.attempts, "in", (g.elapsedMs / 1000).toFixed(1) + "s");

  const c = await api("/api/create", { secretKey: g.secretKey, name: "Smoke Token", symbol: "SMOKE" });
  console.log("created curve for", c.mint);

  await api("/api/buy", { mint: c.mint, sol: 0.2 });
  console.log("bought with 0.2 SOL");

  const s = await api("/api/curve/" + c.mint);
  console.log("curve state: realSOL=", Number(s.realSolReserves) / 1e9, "myTokens=", s.myTokens, "complete=", s.complete);

  await api("/api/sell", { mint: c.mint, pct: 25 });
  const s2 = await api("/api/curve/" + c.mint);
  console.log("after 25% sell: myTokens=", s2.myTokens, "realSOL=", Number(s2.realSolReserves) / 1e9);

  const b2 = await api("/api/balance");
  console.log("final balance:", b2.balance / 1e9, "SOL");
  console.log("PLAYGROUND-SMOKE-OK");
  process.exit(0);
})().catch((e) => { console.error("PLAYGROUND-SMOKE-FAIL", e.message); process.exit(1); });
