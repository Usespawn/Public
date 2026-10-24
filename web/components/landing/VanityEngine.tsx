"use client";

/**
 * Section B — The Vanity Engine.
 * Editorial copy + address anatomy + an *explicitly simulated* generation
 * demo. The demo animation is decorative: the real cryptographic grind
 * happens in the launch wizard with real WebWorkers and real keypairs.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Cpu, KeyRound, Lock } from "lucide-react";
import { Reveal } from "./motion";
import { MANDATORY_SUFFIX } from "@/lib/config";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
/** Illustrative 44-char Base58 address ending in the exact Spw suffix. */
const DEMO_PREFIX = "5Qf3Vh2LmK9nR8pT4wYzCxE7bADuJH6cNgXsWtQmF";

type DemoPhase = "idle" | "grinding" | "found";

export function VanityEngine() {
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [tail, setTail] = useState("···");
  const [attempts, setAttempts] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const reduce = useReducedMotion();

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const startDemo = () => {
    if (timer.current) clearInterval(timer.current);
    if (reduce) {
      setPhase("found");
      return;
    }
    setPhase("grinding");
    setAttempts(0);
    let n = 0;
    timer.current = setInterval(() => {
      n += 137 + Math.floor((n * 7) % 211);
      setAttempts(n);
      let s = "";
      for (let i = 0; i < 3; i++) s += BASE58[Math.floor(Math.random() * BASE58.length)];
      setTail(s);
      // Land on the demo address after ~1.4s of simulated attempts.
      if (n > 1400) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setPhase("found");
      }
    }, 70);
  };

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


          {/* Demo console */}
          <Reveal delay={0.12}>
            <div className="surface relative overflow-hidden rounded-xl shadow-panel">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid/60 to-transparent" />

              <div className="flex items-center justify-between border-b border-line bg-raised/60 px-4 py-2.5">
                <span className="font-mono text-[11.5px] text-muted">vanity-grinder — demo</span>
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                    phase === "found"
                      ? "border-ok/40 bg-ok/10 text-ok"
                      : phase === "grinding"
                        ? "border-acid/40 bg-acid/10 text-acid"
                        : "border-line bg-raised text-faint"
                  }`}
                >
                  {phase === "found" ? "match found" : phase === "grinding" ? "grinding…" : "idle"}
                </span>
              </div>

              {/* Address anatomy (static, illustrative) */}
              <div className="border-b border-line px-4 py-5">
                <code className="block break-all font-mono text-[15px] leading-relaxed tracking-wide">
                  <span className="text-faint">{DEMO_PREFIX.slice(0, 18)}</span>
                  <span className="text-muted">{DEMO_PREFIX.slice(18)}</span>
                  <span
                    className={`rounded bg-acid/15 px-1 font-bold ${phase === "found" ? "text-acid" : "text-acid/50"}`}
                  >
                    {MANDATORY_SUFFIX}
                  </span>
                </code>
                <p className="mt-2 font-mono text-[10.5px] text-faint">
                  44 chars · base58 · the last three characters are the identity
                </p>
              </div>

              {/* Simulated grind readout */}
              <div className="relative px-4 py-5">
                {phase === "grinding" && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-scan bg-gradient-to-r from-transparent via-acid/80 to-transparent motion-reduce:animate-none" />
                )}
                <div className="font-mono text-[13px]">
                  {phase === "idle" && (
                    <p className="text-faint">press start to preview the grind animation</p>
                  )}
                  {phase === "grinding" && (
                    <p className="text-muted">
                      <span className="text-acid">{attempts.toLocaleString()}</span> attempts ·{" "}
                      tail <span className="text-ink">{tail}</span>
                      <span className="animate-blink text-acid">▌</span>
                    </p>
                  )}
                  {phase === "found" && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-ok">
                      ✓ address ends in exact <span className="font-bold">{MANDATORY_SUFFIX}</span> —
                      demo complete
                    </motion.p>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    onClick={startDemo}
                    className="rounded-full border border-line-strong bg-raised px-4 py-2 font-mono text-[12px] text-ink transition-colors hover:border-acid/50 hover:text-acid"
                  >
                    {phase === "grinding" ? "restart demo" : "run demo"}
                  </button>
                  <Link
                    href="/launch"
                    className="group inline-flex items-center gap-1.5 font-mono text-[12.5px] text-acid transition-colors hover:text-ink"
                  >
                    open the real grinder
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                <p className="mt-4 border-t border-line pt-3 font-mono text-[10.5px] leading-relaxed text-faint">
                  this is an illustrative animation, not a cryptographic operation.
                  the real grind generates genuine keypairs and re-validates every result.
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

