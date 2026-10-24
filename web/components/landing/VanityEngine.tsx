"use client";

/**
 * Section B — The Vanity Engine.
 * Editorial copy + address anatomy. The mechanics of generation (workers,
 * attempts, logs, keypairs) are intentionally NOT shown publicly — they run
 * automatically and invisibly inside the launch flow.
 */
import Link from "next/link";
import { ArrowRight, Cpu, KeyRound, Lock } from "lucide-react";
import { Reveal } from "./motion";
import { MANDATORY_SUFFIX } from "@/lib/config";

/** Illustrative 44-char Base58 address ending in the exact Spw suffix. */
const DEMO_PREFIX = "5Qf3Vh2LmK9nR8pT4wYzCxE7bADuJH6cNgXsWtQmF";

export function VanityEngine() {
  return (
    <section id="engine" className="atmos-alt relative overflow-hidden border-b border-line">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute left-[-120px] top-[20%] size-[380px] rounded-full bg-violet/[0.07] blur-[110px]" />

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          {/* Editorial column */}
          <Reveal>
            <span className="tech-label">02 / THE VANITY ENGINE</span>
            <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Your origin, written{" "}
              <span className="bg-gradient-to-r from-acid to-violet bg-clip-text text-transparent">
                into the mint
              </span>
              .
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
              Every SpawnPad launch starts with a genuine Ed25519 keypair, ground
              in your browser by real Web Workers until its address ends in the
              exact case-sensitive characters{" "}
              <span className="font-mono font-semibold text-acid">{MANDATORY_SUFFIX}</span>.
              No lookup tables. No appended decoration. The suffix is cryptographic fact.
            </p>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              A 3-character Base58 suffix spans 58³ ≈ 195,112 expected attempts —
              seconds to minutes on a normal CPU. Private keys never leave your
              device: not to our server, not to logs, not anywhere.
            </p>

            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-3">
              <MiniStat icon={<Cpu className="size-3.5" />} label="engine" value="web workers" />
              <MiniStat icon={<Lock className="size-3.5" />} label="keys" value="browser-only" />
              <MiniStat icon={<KeyRound className="size-3.5" />} label="suffix" value={`exact ${MANDATORY_SUFFIX}`} />
            </div>
          </Reveal>


          {/* Address anatomy (static, illustrative — no generation mechanics) */}
          <Reveal delay={0.12}>
            <div className="surface relative overflow-hidden rounded-xl shadow-panel">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid/60 to-transparent" />

              <div className="flex items-center justify-between border-b border-line bg-raised/60 px-4 py-2.5">
                <span className="font-mono text-[11.5px] text-muted">spw-mint — anatomy</span>
                <span className="rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 font-mono text-[10px] text-ok">
                  verified on every launch
                </span>
              </div>

              <div className="px-4 py-5">
                <code className="block break-all font-mono text-[15px] leading-relaxed tracking-wide">
                  <span className="text-faint">{DEMO_PREFIX.slice(0, 18)}</span>
                  <span className="text-muted">{DEMO_PREFIX.slice(18)}</span>
                  <span className="rounded bg-acid/15 px-1 font-bold text-acid">
                    {MANDATORY_SUFFIX}
                  </span>
                </code>
                <p className="mt-2 font-mono text-[10.5px] text-faint">
                  44 chars · base58 · the last three characters are the identity
                </p>

                <div className="mt-5 space-y-2 font-mono text-[12.5px] text-muted">
                  <p>✓ generated in your browser — automatically, at launch</p>
                  <p>✓ re-verified cryptographically before every transaction</p>
                  <p>✓ confirmed on-chain before success is reported</p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                  <Link
                    href="/launch"
                    className="group inline-flex items-center gap-1.5 font-mono text-[12.5px] text-acid transition-colors hover:text-ink"
                  >
                    launch your token
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                <p className="mt-4 border-t border-line pt-3 font-mono text-[10.5px] leading-relaxed text-faint">
                  this is an illustrative address, not a cryptographic operation.
                  the real launch generates genuine keypairs and re-validates every result.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface flex items-center gap-3 rounded-lg px-3 py-2.5">
      <span className="text-acid">{icon}</span>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</div>
        <div className="truncate font-mono text-[12px] text-ink">{value}</div>
      </div>
    </div>
  );
}

