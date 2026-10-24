"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { WalletButton } from "@/components/WalletButton";

const LABELS: Record<string, string> = {
  explore: "Explore",
  new: "New",
  trending: "Trending",
  launch: "Launch",
  token: "Token",
  portfolio: "Portfolio",
  activity: "Activity",
  docs: "Docs",
  settings: "Settings",
};

export function Topbar() {
  const pathname = usePathname();
  const seg = pathname.split("/")[1] || "";
  const label = LABELS[seg];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-obsidian/70 px-4 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        <span className="font-mono text-[13px] text-faint hidden sm:inline">SpawnPad</span>
        {label && (
          <>
            <ChevronRight className="size-3.5 text-faint hidden sm:inline" />
            <span className="font-mono text-[13px] text-ink truncate">{label}</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      <span className="hidden items-center gap-2 rounded-full border border-acid/25 bg-acid/10 px-3 py-1.5 font-mono text-[12px] text-acid sm:flex">
        <span className="size-1.5 animate-pulse rounded-full bg-acid" />
        Solana {process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "Mainnet" : "Devnet"}
      </span>

      <WalletButton />
    </header>
  );
}
