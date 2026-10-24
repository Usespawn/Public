import type { Metadata } from "next";
import { TokenFeed } from "@/components/TokenFeed";

export const metadata: Metadata = { title: "New launches · SpawnPad" };

export default function NewPage() {
  return <TokenFeed title="New launches" defaultTab="live" />;
}
