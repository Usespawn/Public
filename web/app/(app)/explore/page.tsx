import type { Metadata } from "next";
import { TokenFeed } from "@/components/TokenFeed";

export const metadata: Metadata = { title: "Explore · SpawnPad" };

export default function ExplorePage() {
  return <TokenFeed title="Explore" />;
}
