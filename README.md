# Spawnpad (`spawn.fun`)

A Pump.fun V2-style Solana token launchpad where **every launched token mint
ends with the vanity suffix `Spw`** — enforced both by the off-chain grinder
and by the on-chain program itself.

## Repo layout

```
spawnpad/
├── Anchor.toml                     # Anchor config (localnet, program ID)
├── programs/spawnpad-engine/       # Anchor (Rust) bonding curve engine
│   └── src/
│       ├── lib.rs                  # entrypoint: initialize / create_curve / buy / sell / graduate / migrate
│       ├── state.rs                # GlobalConfig, BondingCurve, LockedLiquidity + events
│       ├── curve_math.rs           # pure virtual-reserve math (u128, checked) + unit tests
│       ├── vanity.rs               # on-chain `Spw` suffix enforcement + tests
│       ├── raydium.rs              # Raydium/CPMM DEX-migration blueprint (constants + layout)
│       └── instructions/           # initialize, create_curve, buy, sell, graduate, migrate
├── packages/vanity-grinder/        # @spawnpad/vanity-grinder — keypair grinding lib + `spawn-grind` CLI
├── tests/spawnpad-engine.ts        # end-to-end Anchor test (grinds real ...Spw mints)
├── keypairs/                       # program keypair + localnet wallet (gitignored)
└── scripts/                        # keypair sync + detached run helpers
```

## Bonding curve mechanics (Pump.fun V2 virtual reserves)

- **Fixed supply**: 1,000,000,000 tokens (6 decimals); 793,100,000 seeded onto
  the curve, the rest exists as *virtual depth* for smooth price discovery.
- **Virtual reserves**: `virtual_sol = real_sol + 0.03 SOL (phantom)`,
  `virtual_token = real_token + 279.9M tokens (phantom)`; price follows
  `x * y = k` over virtual reserves — no initial LP capital required.
- **Buy**: fee taken off the top (default 1% = 100 bps), remainder priced
  against the curve: `tokens_out = net_sol * virtual_token / (virtual_sol + net_sol)`.
- **Sell**: `sol_out = tokens_in * virtual_sol / (virtual_token + tokens_in)`,
  fee taken from the output.
- **Fee split**: protocol treasury vs token creator, configurable (default
  80% / 20% of the 1% fee).
- **Graduation**: when `real_sol_reserves >= graduation_threshold_lamports`
  (default 85 SOL ≈ the $10k–$60k band; configurable), the curve closes and
  auto-emits `GraduationEvent`.
- **Migration**: permissionless `migrate` sweeps SOL + remaining tokens into
  the permanent `LockedLiquidity` PDA and burns the mint & freeze authority —
  LP-burn-equivalent custody. The off-chain migrator then creates the
  Raydium CPMM (Pump-AMM-style) pool from that custody and burns 100% of the
  LP tokens (account layout documented in `src/raydium.rs`).

## The `Spw` vanity guarantee (two layers)

1. **Off-chain grind** — `@spawnpad/vanity-grinder` mines an Ed25519 keypair
   whose Base58 address ends in `Spw` (case-sensitive; `58^-3 ≈ 1/195,112`
   attempts, typically < 1s across CPU cores). The keypair signs the launch tx.
2. **On-chain enforcement** — `create_curve` verifies
   `vanity::is_spawn_vanity(&mint)` (case-insensitive suffix match); a
   non-vanity mint is rejected with `NotSpawnVanity`.

## Quickstart

Prereqs: Node ≥ 20, Rust, Solana CLI 1.18.x, Anchor 0.30.x.

```bash
# install JS deps (also builds the grinder)
npm install

# Rust unit tests (curve math, fees, graduation, vanity checks)
npm run test:rust

# Grinder tests (mines real ...Spw keypairs)
npm run test:grinder

# Build the program, sync the keypair, run end-to-end tests on localnet
npm run deploy:prepare
npm run test:program
```

Grind a vanity mint from the CLI:

```bash
npm run grind --prefix packages/vanity-grinder -- --suffix Spw -o mint.json
```

## API — @spawnpad/vanity-grinder

```ts
import { grindVanityKeypair, generateSpawnKeypair } from "@spawnpad/vanity-grinder";

const { publicKey, secretKey, keypair, attempts, elapsedMs } =
  await generateSpawnKeypair({ threads: 8, onProgress: (p) => console.log(p) });
// publicKey ends with "Spw" — use as the mint keypair in create_curve
```

## Roadmap

- **Step 1 — Engine & vanity CA** ✅ (this deliverable)
- **Step 2 — Next.js frontend + Tailwind/Shadcn + wallet providers**
- **Step 3 — /create launch flow (IPFS metadata + grinder integration)**
- **Step 4 — Explore feed & dashboard**
- **Step 5 — /token/[address] trading page (Lightweight Charts, swapper, activity feed)**
