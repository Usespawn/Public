import type { Metadata } from "next";
import { LaunchWizard } from "@/components/launch/LaunchWizard";

export const metadata: Metadata = {
  title: "Launch · SpawnPad",
  description: "Launch a Solana token with a verified Spw vanity mint.",
};

export default function LaunchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Launch your token</h1>
        <p className="mt-1 text-sm text-faint">
          Spawn Your Token. Own Your Launch. Every SpawnPad mint ends in{" "}
          <span className="font-mono text-acid">Spw</span> — generated automatically
          when you launch, with an optional dev buy.
        </p>
      </div>
      <LaunchWizard />
    </div>
  );
}
