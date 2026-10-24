"use client";

/**
 * Section C — How launching works.
 * GENERATE → CONFIGURE → CONNECT → LAUNCH on an animated connecting path.
 * The visual describes the real wizard flow; a launch is only marked real
 * after the transaction confirms and server-side verification passes.
 */
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { KeyRound, SlidersHorizontal, Wallet, Rocket } from "lucide-react";
import { MANDATORY_SUFFIX } from "@/lib/config";

const NODES = [
  {
    icon: KeyRound,
    title: "GENERATE",
    body: `Real Web Workers grind Ed25519 keypairs until one ends in ${MANDATORY_SUFFIX}. Keys never leave your browser.`,
  },
  {
    icon: SlidersHorizontal,
    title: "CONFIGURE",
    body: "Name, symbol, socials and dev-buy fold into pump.fun's official create_v2 instruction — no hidden fee schedules.",
  },
  {
    icon: Wallet,
    title: "CONNECT",
    body: "Your wallet authorizes as fee payer; the fresh mint keypair co-signs locally before anything is sent.",
  },
  {
    icon: Rocket,
    title: "LAUNCH",
    body: "Transaction submits, confirms, and is re-verified on-chain. Only then does your token enter the public feed.",
  },
];

export function LaunchPath() {
  const reduce = useReducedMotion();

  return (
    <section id="how-it-works" className="atmos relative border-b border-line">
      <div className="dot-matrix-fine pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="mb-14 max-w-2xl">
          <span className="tech-label">03 / HOW LAUNCHING WORKS</span>
          <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Four moves from{" "}
            <span className="text-acid">keypair</span> to{" "}
            <span className="text-acid">confirmed launch</span>.
          </h2>
        </div>

        <div className="relative">
          {/* Animated connecting path (desktop) */}
          <svg
            className="pointer-events-none absolute left-0 right-0 top-7 hidden h-2 w-full md:block"
            preserveAspectRatio="none"
            viewBox="0 0 100 4"
            aria-hidden="true"
          >
            <motion.line
              x1="0"
              y1="2"
              x2="100"
              y2="2"
              stroke="url(#pathGrad)"
              strokeWidth="0.5"
              strokeDasharray="1.6 1.4"
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="pathGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#42E8FF" />
                <stop offset="50%" stopColor="#9670FF" />
                <stop offset="100%" stopColor="#42E8FF" />
              </linearGradient>
            </defs>
          </svg>

          <ol className="grid gap-10 md:grid-cols-4 md:gap-6">
            {NODES.map((n, i) => (
              <motion.li
                key={n.title}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: 0.15 + i * 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="relative"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl border transition-colors ${
                      i === 0
                        ? "border-acid/40 bg-acid/10 text-acid shadow-glow"
                        : "border-line bg-raised text-muted"
                    }`}
                  >
                    <n.icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="font-mono text-[11px] text-faint">step {String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 font-mono text-[14px] font-bold tracking-[0.14em] text-ink">{n.title}</h3>
                <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted">{n.body}</p>
              </motion.li>
            ))}
          </ol>
        </div>

        <p className="mt-12 max-w-2xl border-l-2 border-acid/40 pl-4 font-mono text-[11.5px] leading-relaxed text-faint">
          the flow diagram mirrors the actual wizard. nothing on this page claims a
          token exists — a launch is only announced after the transaction is confirmed
          and re-verified on-chain.
        </p>

        <Link
          href="/launch"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-acid px-6 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]"
        >
          START YOUR LAUNCH →
        </Link>
      </div>
    </section>
  );
}
