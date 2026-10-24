"use client";

import { useState } from "react";
import { getNetwork, getRpcUrl } from "@/lib/config";

export default function SettingsPage() {
  const [rpc, setRpc] = useState(getRpcUrl());
  const network = getNetwork();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-faint">
          Network selection is server/env-controlled for safety — the UI is read-only.
        </p>
      </div>
      <div className="glass rounded-2xl p-6 space-y-3 font-mono text-[13px]">
        <div className="flex justify-between"><span className="text-faint">Network</span><span className={network === "mainnet-beta" ? "text-warn" : "text-acid"}>Solana {network}</span></div>
        <div className="flex justify-between gap-2"><span className="text-faint">RPC</span><span className="truncate text-muted">{rpc}</span></div>
        <div className="flex justify-between"><span className="text-faint">Vanity suffix</span><span className="text-acid">Spw (mandatory)</span></div>
      </div>
      <div className="glass rounded-2xl p-6 text-[13px] text-muted">
        To change the network, set <code className="font-mono text-ink">NEXT_PUBLIC_NETWORK</code>{" "}
        and (optionally) <code className="font-mono text-ink">NEXT_PUBLIC_SOLANA_RPC</code> in{" "}
        <code className="font-mono text-ink">.env.local</code>, then restart the app.
        Mainnet additionally requires explicit confirmation — see{" "}
        <code className="font-mono text-ink">.env.example</code>.
      </div>
    </div>
  );
}
