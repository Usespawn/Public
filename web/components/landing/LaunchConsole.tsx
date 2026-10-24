"use client";

/**
 * Section E — Launch Console. Entry point to the real launch wizard,
 * flanked by the interactive SpawnTerminal (real command parser, real
 * RPC health check, no fabricated output).
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./motion";
import { SpawnTerminal } from "./SpawnTerminal";
import { MANDATORY_SUFFIX } from "@/lib/config";

export function LaunchConsole() {
  return (
    <section id="console" className="atmos relative overflow-hidden border-b border-line">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute right-[10%] top-[-60px] size-[340px] rounded-full bg-acid/[0.06] blur-[110px]" />

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <Reveal>
            <span className="tech-label">06 / LAUNCH CONSOLE</span>
            <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              The console is{" "}
              <span className="text-acid">warm</span>.
              <br />
              Your token isn&apos;t.
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
              The launch wizard walks you through grinding, validation, configuration,
              wallet approval, submission and on-chain verification — seven explicit
              steps, no shortcuts, no silent assumptions. Your{" "}
              <span className="font-mono text-acid">{MANDATORY_SUFFIX}</span> mint is waiting
              to be generated.
            </p>
            <ul className="mt-6 space-y-2 font-mono text-[12.5px] text-muted">
              <li><span className="text-acid">01</span> token info → <span className="text-acid">02</span> grind → <span className="text-acid">03</span> validate</li>
              <li><span className="text-acid">04</span> configure → <span className="text-acid">05</span> review → <span className="text-acid">06</span> execute → <span className="text-acid">07</span> verified</li>
            </ul>
            <Link
              href="/launch"
              className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-acid px-7 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-all hover:bg-[#7DF0FF] hover:shadow-[0_0_46px_rgba(66,232,255,0.3)]"
            >
              OPEN THE WIZARD
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          <Reveal delay={0.12}>
            <SpawnTerminal />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
