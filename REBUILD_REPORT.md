# SpawnPad Rebuild Report

## 1. Existing files replaced
- `web/app/(app)/{analytics,build,explore,profile}` — removed; replaced by the new IA:
  `(app)/{explore,new,trending,launch,portfolio,activity,docs,settings,token/[mint]}`
- `web/components/{Shell,Sidebar,Topbar,WalletProviders}` — rebuilt for the new nav
  (Launch/Trending/Portfolio/Activity/Docs/Settings).
- `web/app/page.tsx` — new hero per Phase 7 ("Spawn your token. Own your launch.").
- Preserved: `programs/spawnpad-engine` (offline fallback engine), `packages/vanity-grinder`
  (reused logic), `playground` (dev harness), all `scripts/*`, keypairs, `.ledger`.
- No git repo existed; nothing to preserve. No production DB existed. `.env` did not exist
  (`.env.example` created).

## 2. New application architecture
- Next.js 14.2.13 App Router + TS + Tailwind + framer-motion + wallet-adapter (Phantom/Solflare).
- Route group `(app)` wraps all app pages in the collapsible-shell; `/` is a bare landing page.
- Client libs: `lib/config` (networks, PDA derivations, suffix validator), `lib/vanity/*`
  (Web Worker grinder + explicit state machine), `lib/launch/launch.ts` (tx build/sign/confirm/verify).
- Server: `lib/server/store.ts` (idempotent JSON store, atomic writes), `lib/server/verify.ts`
  (server-side tx + bonding-curve verification), `app/api/launches/route.ts` (rate-limited).

## 3. Pump.fun SDK & protocol version selected
- Official program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` — deployed on mainnet AND
  devnet (pump-public-docs).
- Official SDK `@pump-fun/pump-sdk` **4.1.0** (installed & pinned; matches docs' version).
- Instruction used: `PUMP_SDK.createV2Instruction({mint, name, symbol, uri, creator, user, mayhemMode})`
  → `create_v2` (Token-2022 mint, mint authority = `[b"mint-authority"]` PDA, bonding curve PDA
  `[b"bonding-curve", mint]`, Metaplex metadata pointer).
- Fees per official Global config: 100 bps protocol fee; creator fee per pump.fun schedule;
  graduation migrates liquidity to PumpSwap and burns the LP.

## 4. How Spw vanity generation works
- `grind.worker.ts` (browser Web Worker): `Keypair.generate()` (WebCrypto CSPRNG) in a loop;
  exact case-sensitive `Spw` suffix check on the full Base58 address; progress messages every
  512 attempts; bounded by maxAttempts.
- `grinder.ts` controller: 1–8 configurable workers (default 2), aggregated progress/aps,
  cancel + terminate lifecycle, independent re-verification of worker output
  (`isSpawnVanityAddress` + keypair→address re-derivation) before acceptance.
- Expected difficulty 58³ ≈ 195,112 attempts; UI shows ETA labelled as a rough estimate.

## 5. Secure keypair usage during launch
- The mint keypair never leaves the browser. `signAndSubmit` calls `tx.partialSign(mintKeypair)`
  locally, clears our copy, then the user's wallet signs as fee payer via `signTransaction`.
- No logging, storage, or transmission of secret material anywhere in the app.

## 6. Does the verified current launch flow support the required mint?
- **Yes.** `create_v2` account 1 (`mint`) is a caller-supplied keypair that must co-sign — the
  exact mechanism pump.fun's own frontend uses to grind its `pump` suffix (documented in
  pump-public-docs + SDK tutorials). SpawnPad uses the same flow with `Spw`.

## 7. Actual launch functionality implemented
- 7-step wizard: token info → grind (state machine IDLE→…→SUCCESS) → validation checklist →
  protocol configuration (read-only, honest) → review w/ irreversibility warning → execute
  (balance check, blockhash, two-signer signing, submit) → verified success page
  (mint, signature, Solscan/pump.fun links, timestamp).
- Post-confirm on-chain verification: mint exists (Token-2022), bonding-curve PDA exists and is
  pump-program-owned, Spw suffix re-checked.

## 8. Features verified on-chain (prior session, still reproducible)
- The pump.funV2-style offline engine (`programs/spawnpad-engine`) is fully tested on localnet:
  15/15 Rust unit tests, 9/9 E2E incl. buy/sell exact pricing, fee split, graduation, migration.
- The **official pump.fun create_v2 launch has NOT yet been executed live** (devnet transaction
  pending first funded-wallet test) — see blockers.

## 9. Tests & production build results
- `web/tests/vanity.test.ts` + `store.test.ts`: **8/8 pass** (tsx --test).
- `npx next build`: **success** — 13 routes, `/launch` first-load 221 kB.
- Grinder engine also validated live in-browser prior builds (8/8 grinder suite).

## 10. Required environment variables (`.env.example` provided)
NEXT_PUBLIC_NETWORK (devnet default), NEXT_PUBLIC_SOLANA_RPC, NEXT_PUBLIC_SOLANA_WS_RPC,
NEXT_PUBLIC_APP_URL, MARKET_DATA_PROVIDER/KEY, DATABASE_URL, SERVER_API_SECRET.

## 11. Current development URL
- Web app: **http://localhost:3000** (dev server running)
- Localnet validator (for the fallback engine): http://127.0.0.1:8899

## 12. Remaining blockers before production deployment
1. Live devnet launch smoke test: connect Phantom funded with devnet SOL and run the wizard
   end-to-end (SDK 4.1.0 instruction verified against docs; first real tx not yet sent).
2. Market-data provider (Supabase/Supamorse indexer or similar) for price/volume/holders —
   currently shown honestly as unavailable.
3. Metadata upload to IPFS (currently immutable `data:` URIs) for production-grade metadata.
4. Migrate JSON store → Postgres/Supabase for multi-instance production.
5. Mainnet program-ID/env confirmation + fee-recipient whitelisting before mainnet.
