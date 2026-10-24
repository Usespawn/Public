# SpawnPad — 15-Tweet X Campaign (`spawnpad-x-campaign`)

Coordinate a 15-post introduction of SpawnPad on X. One original banner per post.

## Contents

| File | Purpose |
|---|---|
| `tweets.md` | All 15 publish-ready tweets (copy-paste ready) with banner mapping and posting order |
| `campaign-plan.md` | Objectives, audience, cadence, engagement guidance, metrics |
| `feature-verification.md` | LIVE / IN DEVELOPMENT / PLANNED inventory with evidence + publish gates |
| `banners/01-introducing-spawnpad.png` … `15-campaign-closer.png` | 15 individual banners, **1600 × 900 px PNG (16:9)** |
| `banners/00-contact-sheet.png` | Internal review index of all 15 banners (NOT for posting) |
| `_render/` | Repeatable banner renderer (HTML + Playwright screenshot workflow) |

## Banner facts

- Format: **PNG**, **1600 × 900 px**, rendered from `banners/_render/banners.html` with headless Chromium (Playwright) using the **actual SpawnPad brand assets** (`web/public/brand/spawnpad-logo-dark.svg`, banner art) and the exact product palette (`obsidian #0B1124`, `acid #42E8FF`, `violet #9670FF`, …).
- Typography: Space Grotesk (display), Inter (body), JetBrains Mono (labels) — the site's real fonts.
- Every banner differs in composition but shares one design system.
- The demonstration address shown on banners 03/09 (`…JSpw`) is **labeled as a demonstration** and is **not** an official token CA.

## Safety & honesty rules used throughout

- No fake metrics, user counts, volume, or partnerships.
- Pump.fun is used as infrastructure — SpawnPad is **not** affiliated with Pump.fun (stated in tweet 05).
- No financial or security guarantees; vanity suffix is branding, not verification.
- No secret keys, API keys, or configuration values appear anywhere in this campaign.
- Nothing here posts automatically — all content is prepared for **manual review and publishing** from https://x.com/spawnpadHQ.
