// SpawnPad RPC connectivity + cluster-identity check (Phase 7).
// Read-only: getGenesisHash + getSlot. No transactions, no wallet signatures.
// Resolves the endpoint EXACTLY like web/lib/config.ts getRpcUrl().
// Never prints secret values; masks any query-string credentials in URLs.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/rpc-check.txt";
const ENV = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/.env.local";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

// CAIP-2 truncated (32-char) genesis-hash references — ChainAgnostic/namespaces.
const CLUSTERS = {
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
};

function maskUrl(u) {
  // scheme+host+path with credential-like segments redacted. Alchemy embeds
  // its key as the LAST PATH segment (/v2/<key>); Helius uses a query param.
  // Redact any path segment that looks like a key and the entire query string.
  try {
    const url = new URL(u);
    const segs = url.pathname.split("/").map((s) =>
      s.length >= 20 && /^[A-Za-z0-9_-]+$/.test(s) ? "<redacted>" : s
    );
    return `${url.protocol}//${url.host}${segs.join("/")}${url.search ? "?<redacted>" : ""}`;
  } catch {
    return "(malformed URL — not printed)";
  }
}

function parseEnv(p) {
  const vars = {};
  if (!fs.existsSync(p)) return vars;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    vars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return vars;
}

async function rpc(endpoint, method) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`rpc error: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function main() {
  const vars = parseEnv(ENV);
  const networkRaw = (vars.NEXT_PUBLIC_NETWORK || "devnet").trim();
  const network =
    networkRaw === "mainnet" || networkRaw === "mainnet-beta"
      ? "mainnet-beta"
      : networkRaw === "localnet"
        ? "localnet"
        : "devnet";
  append(`configured NEXT_PUBLIC_NETWORK = ${networkRaw} -> resolved: ${network}`);

  let endpoint;
  const explicit = vars.NEXT_PUBLIC_SOLANA_RPC;
  if (explicit) {
    endpoint = explicit;
    append(`RPC source: NEXT_PUBLIC_SOLANA_RPC (explicit)`);
  } else {
    endpoint = network === "localnet" ? "http://127.0.0.1:8899" : `https://api.${network}.solana.com`;
    append(`RPC source: cluster default for ${network}`);
  }
  append(`endpoint (masked): ${maskUrl(endpoint)}`);

  try {
    const t0 = Date.now();
    const genesis = await rpc(endpoint, "getGenesisHash");
    const slot = await rpc(endpoint, "getSlot");
    const ms = Date.now() - t0;
    append(`getGenesisHash: ${genesis}`);
    append(`getSlot: ${slot}`);
    append(`latency: ${ms}ms (read-only)`);

    const prefix32 = genesis.slice(0, 32);
    let matched = null;
    for (const [name, ref] of Object.entries(CLUSTERS)) {
      if (prefix32 === ref) matched = name;
    }
    if (matched) {
      append(`cluster identity: ${matched} ${matched === network ? "(MATCHES configured network)" : "(*** MISMATCH with configured network *** -- FAIL CLOSED)"}`);
    } else {
      append(`cluster identity: UNKNOWN genesis (not devnet/mainnet/testnet) -- treat as MISMATCH`);
    }
  } catch (e) {
    append(`RPC CHECK FAILED: ${e.message || e}`);
    append("RPC-CHECK-FAIL");
    return;
  }

  // Pinata configuration status (no upload, no secret printed).
  const jwt = vars.PINATA_JWT || "";
  append(`PINATA_JWT: ${jwt ? (jwt === "PASTE_YOUR_PINATA_JWT_HERE" ? "PLACEHOLDER" : "SET (looksLikeJwt=" + /^eyJ/.test(jwt) + ", not printed)") : "NOT SET"}`);
  append(`PINATA_GATEWAY: ${vars.PINATA_GATEWAY || "(default ipfs.io)"}`);
  append("RPC-CHECK-DONE");
}
main();