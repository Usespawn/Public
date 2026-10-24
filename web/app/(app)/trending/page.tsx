import type { Metadata } from "next";
import { TokenFeed } from "@/components/TokenFeed";

export const metadata: Metadata = { title: "Trending · SpawnPad" };

export default function TrendingPage() {
  return (
    <div className="space-y-3">
      <TokenFeed title="Trending" defaultTab="live" />
      <p className="font-mono text-[12px] text-faint">
        Trending metric: most recent verified launches first (volume/price ranking is
        shown as unavailable until the market-data indexer is connected — no fabricated stats).
      </p>
    </div>
  );
}
