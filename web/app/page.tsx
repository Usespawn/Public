import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { VanityEngine } from "@/components/landing/VanityEngine";
import { LaunchPath } from "@/components/landing/LaunchPath";
import { ExplorerPreview } from "@/components/landing/ExplorerPreview";
import { LaunchConsole } from "@/components/landing/LaunchConsole";
import { FaqSection } from "@/components/landing/FaqSection";
import { getNetwork } from "@/lib/config";

const PARTNERS = ["PUMP.FUN", "PUMPSWAP", "SOLANA", "TOKEN-2022", "METAPLEX", "SOLSCAN", "WALLET ADAPTER"];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-obsidian">
      <Nav />

      {/* A — The Origin */}
      <Hero />

      {/* B — The Vanity Engine */}
      <VanityEngine />

      {/* C — How Launching Works */}
      <LaunchPath />

      {/* D — Explore the Ecosystem (real verified-launch data) */}
      <ExplorerPreview />

      {/* E — Launch Console (real wizard entry + interactive terminal) */}
      <LaunchConsole />

      {/* F — Documentation & FAQ */}
      <FaqSection />

      {/* Footer */}
      <footer className="border-t border-line bg-sea">
        <div className="overflow-hidden border-b border-line py-4">
          <div className="flex w-max animate-marquee gap-10 px-4 motion-reduce:animate-none">
            {[...PARTNERS, ...PARTNERS].map((p, i) => (
              <span key={i} className="font-mono text-[11px] tracking-wider text-faint">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-sm">
              <span className="font-display text-[17px] font-bold">
                Spawn<span className="text-acid">Pad</span>
              </span>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                A Solana token launchpad on Pump.fun&apos;s official engine, with an automatic
                vanity mint ending in <span className="font-mono text-acid">Spw</span> — ground
                in your browser, verified on-chain.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 font-mono text-[13px] sm:grid-cols-1">
              <Link href="/explore" className="text-muted transition-colors hover:text-acid">Explore</Link>
              <Link href="/launch" className="text-muted transition-colors hover:text-acid">Launch</Link>
              <Link href="/docs" className="text-muted transition-colors hover:text-acid">Documentation</Link>
              <Link href="/#faq" className="text-muted transition-colors hover:text-acid">FAQ</Link>
            </div>
            <div className="font-mono text-[12px] text-faint">
              <div>network: {getNetwork()}</div>
              <div className="mt-1">keys stay in your browser</div>
              <div className="mt-1">© {new Date().getFullYear()} SpawnPad</div>
            </div>
          </div>
          <p className="mt-8 border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-faint">
            disclaimer: launching tokens involves risk. SpawnPad provides tooling only — no
            financial advice, no guarantees. verify everything on-chain before acting.
          </p>
        </div>
      </footer>
    </div>
  );
}
