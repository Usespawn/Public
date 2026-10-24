import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandMark";

export const metadata: Metadata = { title: "Brand · SpawnPad" };

const PALETTE: Array<[string, string]> = [
  ["midnight", "#0B1124"],
  ["deep navy", "#101A35"],
  ["electric cyan", "#42E8FF"],
  ["laser blue", "#5885FF"],
  ["cosmic violet", "#9670FF"],
  ["crimson", "#FF537A"],
  ["white", "#F4F7FF"],
];

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-obsidian text-ink">
      {/* Hero — primary logo on midnight */}
      <section className="atmos-hero relative overflow-hidden border-b border-line">
        <div className="grid-lines pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="font-mono text-[11px] tracking-[0.22em] text-faint">
            SPAWNPAD // BRAND IDENTITY · V1
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center rounded-2xl border border-line bg-panel/40 p-10 sm:p-14">
            <BrandLockup className="w-full max-w-[640px]" />
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
            {/* Icon emblem */}
            <div className="grid size-40 place-items-center rounded-2xl border border-line bg-panel/40">
              <BrandEmblemLarge />
            </div>
            <div className="max-w-xl space-y-3">
              <h1 className="font-display text-2xl font-bold">The spawn trajectory.</h1>
              <p className="text-[13.5px] leading-relaxed text-muted">
                Two nib-arrows trace an S across the dark — a launch trajectory
                ending in a pen-nib point, the portal through which every
                SpawnPad token comes into existence. Ring nodes mark the origin
                and the destination; the gradient runs from electric cyan at the
                summit to magenta at ignition.
              </p>
              <p className="text-[13.5px] leading-relaxed text-muted">
                The mark stays recognizable from favicon size to billboard, in
                gradient, light, and single-color versions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Variants */}
      <section className="atmos-alt relative border-b border-line">
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <span className="tech-label">VARIATIONS</span>
          <h2 className="mt-3 font-display text-2xl font-bold">One geometry, every context.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="surface overflow-hidden rounded-xl">
              <div className="grid place-items-center bg-[#F7F9FF] p-10">
                <img src="/brand/spawnpad-logo-light.svg" alt="SpawnPad light-background logo" className="w-full max-w-[520px]" />
              </div>
              <p className="border-t border-line px-4 py-3 font-mono text-[11.5px] text-faint">light surfaces · midnight ink structure</p>
            </div>
            <div className="surface overflow-hidden rounded-xl">
              <div className="grid place-items-center p-10">
                <img src="/brand/spawnpad-emblem-mono-white.svg" alt="SpawnPad monochrome white emblem" className="w-40" />
              </div>
              <p className="border-t border-line px-4 py-3 font-mono text-[11.5px] text-faint">single-color · white on midnight</p>
            </div>
            <div className="surface overflow-hidden rounded-xl">
              <div className="grid place-items-center bg-[#F7F9FF] p-10">
                <img src="/brand/spawnpad-emblem-mono-black.svg" alt="SpawnPad monochrome ink emblem" className="w-40" />
              </div>
              <p className="border-t border-line px-4 py-3 font-mono text-[11.5px] text-faint">single-color · ink on light</p>
            </div>
            <div className="surface overflow-hidden rounded-xl">
              <div className="grid place-items-center p-10">
                <img src="/brand/spawnpad-icon-tile.svg" alt="SpawnPad app icon tile" className="w-40" />
              </div>
              <p className="border-t border-line px-4 py-3 font-mono text-[11.5px] text-faint">app icon · profile picture · favicon</p>
            </div>
          </div>
        </div>
      </section>

      {/* Palette */}
      <section className="atmos relative border-b border-line">
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <span className="tech-label">PALETTE</span>
          <h2 className="mt-3 font-display text-2xl font-bold">Midnight universe, electric accents.</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {PALETTE.map(([name, hex]) => (
              <div key={hex} className="surface overflow-hidden rounded-xl">
                <div className="h-20" style={{ background: hex }} />
                <div className="px-3 py-2.5 font-mono text-[11px]">
                  <div className="text-muted">{name}</div>
                  <div className="text-faint">{hex}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Downloads */}
      <section className="border-b border-line bg-sea">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <span className="tech-label">ASSETS</span>
          <h2 className="mt-3 font-display text-2xl font-bold">Download.</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Primary lockup (dark)", "brand/svg/spawnpad-logo-dark.svg"],
              ["Primary lockup (light)", "brand/svg/spawnpad-logo-light.svg"],
              ["Emblem — gradient", "brand/svg/spawnpad-emblem-gradient.svg"],
              ["Emblem — mono white", "brand/svg/spawnpad-emblem-mono-white.svg"],
              ["Emblem — mono ink", "brand/svg/spawnpad-emblem-mono-black.svg"],
              ["Icon tile (square)", "brand/svg/spawnpad-icon-tile.svg"],
              ["Wordmark only", "brand/svg/spawnpad-wordmark.svg"],
              ["PNG · logo dark 1288", "brand/png/spawnpad-logo-dark.png"],
              ["PNG · icon 512", "brand/png/spawnpad-icon-tile-512.png"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                download
                className="surface group flex items-center justify-between rounded-xl px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-acid/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="font-mono text-[12.5px] text-muted group-hover:text-acid">{label}</span>
                <span className="font-mono text-[11px] text-faint">{href.split(".").pop()?.toUpperCase()}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-obsidian py-10 text-center">
        <Link href="/" className="font-mono text-[12px] text-faint transition-colors hover:text-acid">
          ← back to spawnpad
        </Link>
      </footer>
    </div>
  );
}

/** 128px-tall trajectory emblem used in the concept row (inline for crispness). */
function BrandEmblemLarge() {
  return (
    <svg width="57" height="128" viewBox="0 0 100 224" fill="none" role="img" aria-label="SpawnPad emblem">
      <defs>
        <linearGradient id="bpTraj" x1="95" y1="5" x2="15" y2="215" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2BE5FF" />
          <stop offset="0.38" stopColor="#4E86FF" />
          <stop offset="0.68" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#E73BD6" />
        </linearGradient>
      </defs>
      <path d="M57.5 169 L76 154 L24 70 L42.9 54.6" stroke="url(#bpTraj)" strokeWidth="14" fill="none" strokeLinejoin="round" />
      <path d="M15.1 203.5 L44.2 179.8" stroke="url(#bpTraj)" strokeWidth="14" fill="none" />
      <path d="M56.1 43.9 L84.9 20.5" stroke="url(#bpTraj)" strokeWidth="14" fill="none" />
      <path d="M99 1 L91 27 L97 54 L79 34 L66 24 L74 9 Z" fill="url(#bpTraj)" />
      <path d="M1 223 L9 197 L3 170 L21 178 L34 200 L26 215 Z" fill="url(#bpTraj)" />
      <circle cx="49.5" cy="49.3" r="8.5" stroke="url(#bpTraj)" strokeWidth="3.5" fill="none" />
      <circle cx="51" cy="174" r="8.5" stroke="url(#bpTraj)" strokeWidth="3.5" fill="none" />
    </svg>
  );
}


