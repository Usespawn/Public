// Rewrites web/.env.local into the Mainnet-ready template while PRESERVING
// the real PINATA_JWT. The JWT is extracted from the current file and written
// directly into the new content — it never appears in chat output.
// ABORTS (writes nothing) if the JWT is missing or a placeholder.
const fs = require("fs");
const BASE = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const ENV = BASE + "/web/.env.local";
const BACKUP = BASE + "/web/.env.local.pre-mainnet-backup";
const LOG = BASE + "/env-rewrite.log";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

// 1. Extract the real JWT.
const cur = fs.readFileSync(ENV, "utf8");
let jwt = null;
for (const raw of cur.split(/\r?\n/)) {
  const line = raw.trim();
  if (line.startsWith("PINATA_JWT=")) {
    jwt = line.slice("PINATA_JWT=".length).trim().replace(/^["']|["']$/g, "");
    break;
  }
}
const ok = jwt && jwt.length > 20 && !/PASTE_|YOUR_|REPLACE/i.test(jwt) && /^eyJ/.test(jwt);
append(`jwt-preserved: ${ok ? "true" : "false"} (length=${jwt ? jwt.length : 0}, looksLikeJwt=${ok ? "true" : "false"}, value never printed)`);
if (!ok) {
  append("ABORT: real PINATA_JWT not found — existing file left untouched.");
  process.exit(1);
}

// 2. Back up the current file, then write the new template.
fs.writeFileSync(BACKUP, cur);
append(`backup written: ${BACKUP}`);

const NEW = `# ============================================================
# SPAWNPAD — LOCAL ENVIRONMENT CONFIGURATION
# Fill in the values marked YOUR_... before using each feature.
# Never commit this file or expose server-only secrets.
# (Git-ignored via .env.* in the root .gitignore.)
# ============================================================

# ------------------------------------------------------------
# 1. NETWORK CONFIGURATION
# ------------------------------------------------------------

# Target Solana cluster: devnet | mainnet | mainnet-beta | localnet
# Read by lib/config.ts getNetwork() — the SINGLE resolver shared by the
# browser wallet adapter (components/WalletProviders.tsx), every
# new Connection() site, and server-side launch verification
# (lib/server/verify.ts). Anything unrecognised falls back to devnet
# (fail-closed: a typo can never silently route Mainnet operations).
# NOTE: "mainnet" and "mainnet-beta" both select Mainnet; "mainnet" also
# renders the Topbar network badge correctly.
NEXT_PUBLIC_NETWORK=mainnet

# Solana RPC endpoint for the selected cluster.
# Obtain a Mainnet endpoint from Helius (https://helius.dev — free tier) or
# another supported RPC provider and paste it here.
# This ONE endpoint serves the browser wallet, the launch transaction flow,
# and server-side verification. There are no hardcoded RPC URLs in the app.
# IMPORTANT: NEXT_PUBLIC_ values are exposed to browser clients — the ENTIRE
# URL, including any embedded API key, is visible to every visitor. Restrict
# the key in the provider dashboard (Helius: origin/referer allow-listing and
# a low rate limit).
# While EMPTY, the app falls back to the official public cluster endpoint
# (https://api.mainnet-beta.solana.com) — functional but strictly
# rate-limited. Set your provider endpoint before any real use.
# Cluster-identity check (read-only, prints no secrets):
#   node scripts\\rpc-check.cjs
NEXT_PUBLIC_SOLANA_RPC=

# ------------------------------------------------------------
# 2. TOKEN IMAGE AND METADATA — PINATA
# ------------------------------------------------------------

# Server-side Pinata JWT with the minimum permissions required for uploading
# token images and metadata (pinata.cloud -> Account Settings -> API Keys ->
# New Key -> files:write). Keep this secret. NEVER use a NEXT_PUBLIC_ prefix.
# Value preserved from the verified configuration (never printed).
PINATA_JWT=${jwt}

# Public IPFS gateway used by the existing metadata implementation
# (lib/metadata/upload.ts buildImageGatewayUrl). Any gateway serving
# /ipfs/<cid> works; the URL/host is normalized by the code.
PINATA_GATEWAY=https://gateway.pinata.cloud

# ------------------------------------------------------------
# 3. APPLICATION URL — ONLY IF IMPLEMENTED
# ------------------------------------------------------------

# Not read by any current code path (reserved for share/OG links).
# NEXT_PUBLIC_APP_URL=

# ------------------------------------------------------------
# 4. DATABASE — ONLY IF IMPLEMENTED
# ------------------------------------------------------------

# The current build persists verified launches to a local JSON file
# (web/.data/launches.json, lib/server/store.ts). Uncomment only when a
# database client is actually added to the code.
# DATABASE_URL=

# ------------------------------------------------------------
# 5. MARKET DATA — ONLY IF IMPLEMENTED
# ------------------------------------------------------------

# No market-data provider module exists in the current build.
# MARKET_DATA_PROVIDER=
# MARKET_DATA_API_KEY=

# ------------------------------------------------------------
# 6. OTHER SERVER-SIDE SECRETS — ONLY IF IMPLEMENTED
# ------------------------------------------------------------

# No auth/session layer exists in the current build; API rate limiting is
# in-memory per IP (web/app/api/*). Uncomment only when the code reads it.
# SERVER_API_SECRET=

# ============================================================
# MAINNET CLUSTER VERIFICATION — run after filling the RPC above:
#   node scripts\\rpc-check.cjs
# getGenesisHash must start with 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
# (mainnet-beta). If it reports devnet (EtWTRABZaYq6iMfeYKouRu166VU2xqa1)
# or testnet (4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z) the endpoint and the
# configured network DO NOT MATCH — stop and fix the endpoint.
# ============================================================
`;
fs.writeFileSync(ENV, NEW);
append("env-rewrite: DONE — .env.local reorganized, JWT preserved, network set to mainnet.");