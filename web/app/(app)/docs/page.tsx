import Link from "next/link";
import { MANDATORY_SUFFIX } from "@/lib/config";
import { Reveal } from "@/components/landing/motion";

export default function DocsPage() {
  return (
    <div className="relative mx-auto max-w-3xl space-y-8 overflow-hidden">
      {/* Page atmosphere */}
      <div className="pointer-events-none absolute inset-x-[-80px] top-[-40px] h-[240px] rounded-full bg-acid/[0.05] blur-[100px]" />

      <Reveal>
        <div>
          <span className="tech-label">SPAWNPAD // DOCUMENTATION</span>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">
            How SpawnPad <span className="text-acid">works</span>.
          </h1>
          <p className="mt-2 text-sm text-muted">In plain language, with the receipts.</p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Section title={`The mandatory ${MANDATORY_SUFFIX} mint`} tag="01 / VANITY">
          <p>
            Every token launched through SpawnPad uses a real Solana keypair whose public address ends
            in the exact case-sensitive characters <code className="font-mono text-acid">Spw</code>.
            The keypair is ground in your browser with your device&apos;s WebCrypto — the private key never
            leaves your browser. The mint address is never faked, shortened, or decorated: it is the
            actual mint account created on-chain.
          </p>
          <p>
            A 3-character Base58 suffix has a search space of 58³ ≈ 195,112 — expect a grind of
            seconds to minutes depending on your CPU and worker count. Generation is never guaranteed
            to finish in any particular time, and can be cancelled at any point.
          </p>
        </Section>
      </Reveal>

      <Reveal delay={0.05}>
        <Section title="Pump.fun integration" tag="02 / ENGINE">
          <p>
            SpawnPad launches through the official pump.fun program{" "}
            <code className="font-mono text-[12px]">6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P</code>{" "}
            using its <code className="font-mono">create_v2</code> instruction, which accepts a
            caller-supplied mint keypair that co-signs the launch transaction. This is the same
            mechanism pump.fun&apos;s own frontend uses to grind its <code className="font-mono">pump</code>{" "}
            suffix.
          </p>
          <p>
            Trading happens on pump.fun&apos;s bonding curve (virtual reserves, 1% protocol fee). When a
            curve graduates, liquidity migrates to PumpSwap and the LP is burned.
          </p>
        </Section>
      </Reveal>

      <Reveal delay={0.05}>
        <Section title="Signatures and security" tag="03 / SECURITY">
          <p>
            Two signatures are required on the launch transaction: your wallet (fee payer / authority)
            and the freshly ground mint keypair. The mint keypair signs locally in your browser before
            the transaction is presented to your wallet. SpawnPad&apos;s server never receives any private
            key; it only re-verifies the confirmed transaction before listing a launch as verified.
          </p>
        </Section>
      </Reveal>

      <Reveal delay={0.05}>
        <Section title="Networks" tag="04 / NETWORKS">
          <p>
            Development defaults to <strong>devnet</strong> where the pump.fun program is officially
            deployed. Mainnet requires an explicit configuration change in settings/env — SpawnPad
            will never silently switch to mainnet.
          </p>
        </Section>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="flex items-center justify-between rounded-xl border border-line-strong bg-raised/50 px-5 py-4">
          <span className="font-mono text-[13px] text-muted">Ready to try?</span>
          <Link
            href="/launch"
            className="inline-flex items-center gap-2 rounded-full bg-acid px-5 py-2 font-mono text-[12.5px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]"
          >
            Launch a token →
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

function Section({
  title,
  tag,
  children,
}: {
  title: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface relative overflow-hidden rounded-2xl p-6 shadow-panel">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid/50 to-transparent" />
      <span className="font-mono text-[10.5px] tracking-[0.2em] text-violet">{tag}</span>
      <h2 className="mt-1.5 font-display text-lg font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}
