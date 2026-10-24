"use client";

/**
 * Section F — Documentation & FAQ. Accordion with smooth height animation
 * (grid-rows technique, GPU-cheap), disabled under reduced motion.
 */
import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { Reveal } from "./motion";
import { MANDATORY_SUFFIX } from "@/lib/config";

const FAQS = [
  {
    q: `Why does every mint have to end in ${MANDATORY_SUFFIX}?`,
    a: `The suffix is SpawnPad's proof-of-origin: a real Solana keypair whose address ends in the exact case-sensitive characters ${MANDATORY_SUFFIX}. It comes from genuine Ed25519 generation in your browser — it is never appended, faked, or looked up. The launch wizard refuses to continue until independent validation passes.`,
  },
  {
    q: "Where does my private key go?",
    a: "Nowhere. Keypairs are generated in Web Workers inside your browser and live only in page memory. SpawnPad's server never receives key material; it only re-verifies the confirmed launch transaction after the fact.",
  },
  {
    q: "How long does generation take?",
    a: `A 3-character Base58 suffix spans 58³ ≈ 195,112 expected attempts — typically seconds to a few minutes depending on CPU and worker count. It is probabilistic: no time is guaranteed, and you can cancel anytime.`,
  },
  {
    q: "Which engine actually launches the token?",
    a: "The official pump.fun program (6EF8…F6P) via its create_v2 instruction — the same mechanism pump.fun's own frontend uses for its vanity suffix. Trading runs on the bonding curve; graduation migrates liquidity to PumpSwap with the LP burned.",
  },
  {
    q: "What does 'verified launch' mean in the explorer?",
    a: "SpawnPad's server re-reads the confirmed transaction and bonding-curve PDA from the configured RPC. Only launches passing that check appear in the public feed — an address ending in Spw alone is never listed as a SpawnPad launch.",
  },
  {
    q: "Which network is used?",
    a: "Development defaults to devnet, where the pump.fun program is officially deployed. Mainnet requires a deliberate env change — SpawnPad never switches networks silently.",
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section id="faq" className="atmos-alt relative overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute right-[-120px] top-[10%] size-[360px] rounded-full bg-acid/[0.06] blur-[110px]" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
          <Reveal>
            <span className="tech-label">05 / DOCS &amp; FAQ</span>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Questions,{" "}
              <span className="text-acid">answered</span>.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              The short version of how SpawnPad works. The full documentation
              covers the engine, the vanity grind, and on-chain verification in detail.
            </p>
            <Link
              href="/docs"
              className="mt-6 inline-flex h-11 items-center rounded-full border border-line-strong bg-raised/60 px-6 font-mono text-[12.5px] font-bold text-ink transition-colors hover:border-acid/50 hover:text-acid"
            >
              READ THE DOCS →
            </Link>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel/60">
              {FAQS.map((f, i) => {
                const open = openIdx === i;
                return (
                  <div key={i}>
                    <button
                      onClick={() => setOpenIdx(open ? null : i)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-raised/40"
                    >
                      <span className={`text-[14.5px] font-medium ${open ? "text-acid" : "text-ink"}`}>{f.q}</span>
                      <motion.span
                        animate={{ rotate: open ? 45 : 0 }}
                        transition={{ duration: reduce ? 0 : 0.25 }}
                        className={`shrink-0 ${open ? "text-acid" : "text-faint"}`}
                      >
                        <Plus className="size-4" />
                      </motion.span>
                    </button>
                    <div
                      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
                      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-muted">{f.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
