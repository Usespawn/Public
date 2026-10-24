# SpawnPad — Feature Verification (campaign honesty ledger)

Evidence sources: this workspace's audits (source inspection), automated tests
(`npx tsx --test tests/metadata.test.ts tests/vanity.test.ts` — 34/34 pass),
isolated production build (exit 0), clean-context browser checks (no console
errors), Mainnet RPC genesis verification, and Pinata upload smoke tests with
public gateway retrieval of both test CIDs.

## LIVE — implemented and verified

| Feature | Evidence |
|---|---|
| 7-step launch wizard (connect → token info → vanity → validate → configure → review → execute → verified success) | `components/launch/*`, browser checks: badge, wallet modal, forms render; no console errors |
| Vanity mint generation ending in exact case-sensitive `Spw` | `lib/vanity/grind.worker.ts` (CSPRNG `Keypair.generate()`, `endsWith(suffix)`); `lib/config.ts isSpawnVanityAddress` (44/43-char Base58 + `endsWith("Spw")`); unit tests 27–30 pass |
| Generated mint keypair IS the launch mint | `lib/launch/launch.ts buildCreateTransaction` — `mint: params.mintKeypair.publicKey`; create_v2 IDL: `mint` = writable + signer |
| Secret key never leaves the browser | `grind.worker.ts` posts to page memory only; `/api/launches` payload contains no key material; wallet signing via `signTransaction` |
| Token image + metadata upload to IPFS (Pinata Files API v3, public network) | `lib/metadata/pinata.ts` + routes; smoke test: image CID + metadata CID both publicly retrieved via gateway; metadata JSON links the image CID |
| Metadata URI validation before launch | `isIpfsHttpsUrl` + `isPlausibleCid` in `LaunchWizard.executeLaunch` |
| Phantom + Solflare wallet support | `components/WalletProviders.tsx`; browser check: modal lists both |
| Solana Mainnet configuration (genesis-verified) + devnet default | `.env.local` NEXT_PUBLIC_NETWORK; `scripts/rpc-check.cjs` output matches mainnet-beta genesis |
| Official Pump.fun program, create_v2, Token-2022, mayhem off | `lib/launch/launch.ts` + vendored IDL (`create_v2`, 16 accounts, `mint` signer, `mint_authority` PDA) |
| Transaction confirmation + on-chain verification | `confirmLaunch` (confirmed/finalized polling, error + timeout paths) + `verifyLaunchOnChain` (mint + bonding-curve PDA ownership) |
| Preflight enabled submission | `sendRawTransaction(..., { skipPreflight: false, maxRetries: 3 })` |
| Verified-launch explorer feed + portfolio | `app/api/launches` + `lib/server/store.ts` (JSON store, idempotent, server-verified only) |
| Automated tests + production build | 34/34 pass; isolated `next build` exit 0 |
| X + GitHub + CA chip in navigation | browser checks (hrefs, new-tab popups, adjacency) |

## IN DEVELOPMENT — partially implemented / being tested

| Item | Status | Evidence/gap |
|---|---|---|
| Real-browser wallet-connection E2E (Phantom/Solflare extension flow) | Untested manually | Headless cannot load extensions; modal-level checks only |
| Official Spawn token CA reveal | Awaiting the real address | `SPAWN_OFFICIAL_TOKEN_CA = "TBA"` (chip implemented, copy path tested with a temp address) |

## PLANNED — not implemented (may be described only as plans)

| Item | Evidence of absence |
|---|---|
| Real-time activity feeds (WebSocket) | No WS code anywhere; confirmation uses HTTP polling |
| Market-data / price charts from external providers | `lightweight-charts` renders on-chain data only; no provider module/keys |
| Database-backed store (Postgres/Supabase) | JSON file store; `DATABASE_URL` reserved, unread |
| Authentication / internal API secrets | No auth layer; in-memory rate limiting only |
| Metadata editing / authority reclamation post-launch | No client or IDL surface; mint authority → pump `mint-authority` PDA |
| Richer cost pre-approval breakdown | Balance guard (≥0.05 SOL) + review step exist; itemized display not built |

## Publish gates (do not post until verified)

- **Tweet 12 (What's next)** — fine to publish: framed as plans, not features.
- Any future tweet claiming **wallet-extension connection works E2E** — wait for the manual Phantom/Solflare test.
- Any future tweet showing the **official CA** — wait until `SPAWN_OFFICIAL_TOKEN_CA` is set and the launch flow used it on-chain.
- Any tweet implying **partnership/affiliation** with Pump.fun — prohibited unless formally verified.
