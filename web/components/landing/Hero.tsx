"use client";

/**
 * Hero — editorial headline on the left, the original "Digital Genesis"
 * circuit animation on the right, and the official SpawnPad banner used
 * as a STATIC background watermark (never animated: no parallax, no float,
 * no zoom — plain <img> with opacity + legibility gradients).
 */
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { DigitalGenesis } from "./DigitalGenesis";
import { getNetwork, MANDATORY_SUFFIX } from "@/lib/config";

const BANNER = "/images/Spawnpad-banner.png";

export function Hero() {
  const { connected, publicKey } = useWallet();
  const network = getNetwork();
  const reduce = useReducedMotion();

  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
        };

  return (
    <section className="atmos-hero relative overflow-hidden">
      {/* Static brand-banner watermark — deliberately NOT animated.
          Sits behind the scene on the right, low opacity, cropped with
          object-cover (original proportions preserved, no distortion),
          faded into the midnight-blue background with gradient overlays
          so headline + CTAs stay fully readable. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
        <img
          src={BANNER}
          alt=""
          draggable={false}
          loading="eager"
          decoding="async"
          className="absolute right-0 top-0 h-full w-full object-cover object-center opacity-[0.08] sm:opacity-[0.12] lg:w-[62%]"
        />
        {/* Legibility fades — left column clean, edges dissolve into navy */}
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-obsidian/55" />
      </div>
      <div className="grid-lines pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-28 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-28 lg:pt-36">
        {/* Left — editorial */}
        <div>
          <motion.div {...enter(0)} className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-line bg-raised/50 px-4 py-2 backdrop-blur-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-acid opacity-50 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-acid" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.22em] text-muted">
              SPAWNPAD // SOLANA LAUNCH SYSTEM
            </span>
          </motion.div>

          <h1 className="font-display text-[52px] font-bold leading-[0.98] tracking-tight sm:text-7xl lg:text-[84px]">
            <motion.span {...enter(0.08)} className="block">
              EVERY TOKEN
            </motion.span>
            <motion.span {...enter(0.16)} className="block">
              HAS AN{" "}
              <span className="bg-gradient-to-r from-acid to-violet bg-clip-text text-transparent">
                ORIGIN.
              </span>
            </motion.span>
          </h1>

          <motion.p {...enter(0.34)} className="mt-7 max-w-lg text-[15.5px] leading-relaxed text-muted">
            Create your token. Customize your mint address. Launch on Solana with SpawnPad —
            a genuine vanity mint ending in <span className="font-mono font-semibold text-acid">{MANDATORY_SUFFIX}</span>,
            ground in your browser, verified on-chain.
          </motion.p>

          <motion.div {...enter(0.44)} className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/launch"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-acid px-7 font-mono text-[13px] font-bold tracking-wide text-obsidian shadow-glow transition-all hover:bg-[#7DF0FF] hover:shadow-[0_0_46px_rgba(66,232,255,0.3)]"
            >
              Launch a Token
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/explore"
              className="group inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-raised/50 px-7 font-mono text-[13px] font-bold tracking-wide text-ink backdrop-blur-sm transition-colors hover:border-acid/50 hover:text-acid"
            >
              <Compass className="size-4 text-acid" />
              Explore Tokens
            </Link>
          </motion.div>

          {/* Genuine status row */}
          <motion.div {...enter(0.54)} className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11.5px] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-ok" /> network: {network}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${connected ? "bg-ok" : "bg-warn"}`} />
              wallet:{" "}
              {connected && publicKey
                ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
                : "not connected"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-violet" /> engine: pump.fun create_v2
            </span>
          </motion.div>
        </div>

        {/* Right — Digital Genesis circuit animation (independent of the banner) */}
        <motion.div {...enter(0.3)} className="lg:pl-2">
          <DigitalGenesis />
        </motion.div>
      </div>
    </section>
  );
}
