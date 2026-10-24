"use client";

/** Steps 3-4: mint validation + launch configuration. */
import { CheckRow } from "./ui";
import { getNetwork, MANDATORY_SUFFIX } from "@/lib/config";

export function StepValidate({ mint58, onContinue }: { mint58: string; onContinue: () => void }) {
  return (
    <div className="glass rounded-2xl p-6 space-y-3">
      <h2 className="font-display text-lg font-bold">03 · Mint validation</h2>
      <ul className="space-y-2 text-[13px]">
        <CheckRow ok label="Keypair derives exactly this public key (re-derived on this page)" />
        <CheckRow ok label={`Address ends in exact case-sensitive '${MANDATORY_SUFFIX}' (${mint58.slice(-3)})`} />
        <CheckRow ok label="Address is valid Base58 (44 chars, no 0/O/I/l)" />
        <CheckRow ok label={`Network: Solana ${getNetwork()}`} />
        <CheckRow ok label="Official pump.fun create_v2 accepts caller-supplied mint keypairs (mint co-signs)" />
      </ul>
      <p className="text-[12px] text-faint">
        On-chain state (mint account, bonding-curve PDA) is verified after the transaction confirms
        in step 06 — pre-launch these accounts do not exist, which is expected.
      </p>
      <button onClick={onContinue} className="self-start rounded-full bg-acid px-6 py-2.5 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]">
        Continue →
      </button>
    </div>
  );
}

export function StepConfigure({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="glass rounded-2xl p-6 space-y-3">
      <h2 className="font-display text-lg font-bold">04 · Launch configuration</h2>
      <div className="space-y-2 font-mono text-[13px] text-muted">
        <div className="flex justify-between"><span className="text-faint">Launch mechanism</span><span className="text-ink">pump.fun create_v2 (official program)</span></div>
        <div className="flex justify-between"><span className="text-faint">Quote asset</span><span className="text-ink">SOL</span></div>
        <div className="flex justify-between"><span className="text-faint">Protocol fee</span><span className="text-ink">1% of trades (set by pump.fun)</span></div>
        <div className="flex justify-between"><span className="text-faint">Creator fee</span><span className="text-ink">pump.fun default schedule</span></div>
        <div className="flex justify-between"><span className="text-faint">Initial buy</span><span className="text-ink">none (curve starts empty)</span></div>
        <div className="flex justify-between"><span className="text-faint">Graduation</span><span className="text-ink">auto-migrates to PumpSwap, LP burned</span></div>
      </div>
      <p className="text-[12px] text-faint">
        Fees and curve parameters are enforced by the official pump.fun program — SpawnPad does not
        override protocol settings.
      </p>
      <button onClick={onContinue} className="self-start rounded-full bg-acid px-6 py-2.5 font-mono text-[13px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF]">
        Continue →
      </button>
    </div>
  );
}
