"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { WalletButton } from "@/components/WalletButton";
import { Menu, X, Copy, Check, Github } from "lucide-react";
import { SPAWN_OFFICIAL_TOKEN_CA } from "@/lib/config";
import { getNetwork } from "@/lib/config";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/BrandMark";

/** Official X (Twitter) brand logo — lucide has no brand icons, so inline SVG. */
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Status message shown inside the CA chip for ~2s after a click. */
type CaMsg = "idle" | "copied" | "failed" | "soon";

/**
 * Official Spawn token CA chip — sits right of the X logo.
 * - Real CA: shows a truncated address (full value in the tooltip); a click
 *   copies the COMPLETE address ("Copied!" confirmation, graceful failure).
 * - "TBA": renders the placeholder and NEVER copies the literal text — a
 *   click shows "Official CA coming soon".
 */
function SpawnCaChip({ compactLabel = false }: { compactLabel?: boolean }) {
  const ca = SPAWN_OFFICIAL_TOKEN_CA;
  const copyable = !!ca && !/^tba$/i.test(ca.trim());
  const short = copyable ? `${ca.slice(0, 4)}…${ca.slice(-4)}` : "TBA";
  const [msg, setMsg] = useState<CaMsg>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (m: CaMsg) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg("idle"), 2000);
  };

  const onClick = async () => {
    if (!copyable) {
      flash("soon"); // placeholder is never copied
      return;
    }
    try {
      await navigator.clipboard.writeText(ca); // always the COMPLETE address
      flash("copied");
    } catch {
      flash("failed");
    }
  };

  const shown =
    msg === "copied" ? "Copied!" :
    msg === "failed" ? "Copy failed" :
    msg === "soon" ? "Official CA coming soon" :
    short;

  return (
    <button
      type="button"
      onClick={onClick}
      title={copyable ? `Copy official Spawn token CA: ${ca}` : "Official CA coming soon"}
      aria-label={copyable ? "Copy official Spawn token CA" : "Official Spawn token CA coming soon"}
      aria-live="polite"
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-raised/40 px-3 py-1.5",
        "font-mono text-[11px] tracking-wide transition-colors",
        copyable ? "hover:border-acid/50" : "cursor-default",
        msg === "soon" ? "border-warn/40" : ""
      )}
    >
      {!compactLabel && <span className="shrink-0 text-faint">SPAWN CA</span>}
      <span
        className={cn(
          "truncate",
          msg === "copied" ? "text-ok" : msg === "failed" || msg === "soon" ? "text-warn" : copyable ? "text-acid" : "text-muted"
        )}
      >
        {shown}
      </span>
      {copyable && (
        <span className="shrink-0 text-faint group-hover:text-acid">
          {msg === "copied" ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />}
        </span>
      )}
    </button>
  );
}

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/#engine", label: "Vanity Engine" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/docs", label: "Documentation" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const network = getNetwork();
  const { scrollY } = useScroll();

  // rAF-free scroll gating via framer's motion value (no rerender per frame).
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  const linkCls = (href: string) => {
    const active = href.startsWith("/#") ? false : pathname === href;
    return cn(
      "group relative text-[13px] transition-colors",
      active ? "text-acid" : "text-muted hover:text-ink"
    );
  };

  return (
    <nav
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "border-b border-line bg-obsidian/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SpawnPad home">
          <BrandMark size={30} />
          <span className="font-display text-[17px] font-bold tracking-tight">
            Spawn<span className="text-acid">Pad</span>
          </span>
        </Link>

        <div className="flex-1" />

        {/* Desktop links */}
        <div className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls(l.href)}>
              {l.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-acid transition-all duration-300 group-hover:w-full motion-reduce:transition-none" />
            </Link>
          ))}
        </div>

        <span
          className={cn(
            "hidden rounded-full border px-2.5 py-1 font-mono text-[11px] md:block",
            network === "mainnet-beta"
              ? "border-warn/30 bg-warn/10 text-warn"
              : "border-acid/25 bg-acid/10 text-acid"
          )}
        >
          {network === "mainnet-beta" ? "mainnet" : network}
        </span>

        <div className="hidden lg:block">
          <WalletButton />
        </div>

        <Link
          href="/launch"
          className="hidden rounded-full bg-acid px-4 py-2 font-mono text-[12.5px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF] lg:block"
        >
          Launch Token
        </Link>

        {/* X (Twitter) profile — desktop, beside the Launch Token pill */}
        <a
          href="https://x.com/spawnpadHQ"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="SpawnPad on X"
          title="Follow SpawnPad on X"
          className="hidden size-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-acid/50 hover:text-acid lg:inline-flex"
        >
          <XLogo className="size-4" />
        </a>

        {/* GitHub profile — grouped with the X logo, before the CA chip */}
        <a
          href="https://github.com/Usespawn"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="SpawnPad on GitHub"
          title="Visit SpawnPad on GitHub"
          className="hidden size-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-acid/50 hover:text-acid lg:inline-flex"
        >
          <Github className="size-4" />
        </a>

        {/* Official Spawn token CA — immediately right of the X logo (desktop) */}
        <span className="hidden lg:inline-flex">
          <SpawnCaChip />
        </span>

        {/* Mobile toggle */}
        <button
          className="text-ink lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle navigation menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-line bg-obsidian/95 px-4 py-3 backdrop-blur-xl lg:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-[14px] text-muted hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex flex-wrap items-center gap-3 py-3">
            <WalletButton />
            <Link
              href="/launch"
              onClick={() => setOpen(false)}
              className="rounded-full bg-acid px-4 py-2 font-mono text-[12.5px] font-bold text-obsidian"
            >
              Launch Token
            </Link>
            {/* X (Twitter) profile — mobile menu, beside the Launch Token pill */}
            <a
              href="https://x.com/spawnpadHQ"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="SpawnPad on X"
              title="Follow SpawnPad on X"
              onClick={() => setOpen(false)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-acid/50 hover:text-acid"
            >
              <XLogo className="size-4" />
            </a>
            {/* GitHub profile — grouped with the X logo, before the CA chip */}
            <a
              href="https://github.com/Usespawn"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="SpawnPad on GitHub"
              title="Visit SpawnPad on GitHub"
              onClick={() => setOpen(false)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-acid/50 hover:text-acid"
            >
              <Github className="size-4" />
            </a>
            {/* Official Spawn token CA — immediately right of the X logo (mobile menu) */}
            <SpawnCaChip compactLabel />
          </div>
        </div>
      )}
    </nav>
  );
}
