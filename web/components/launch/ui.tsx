"use client";

import { Check, X, AlertTriangle } from "lucide-react";
import { VanityState } from "@/lib/vanity/state-machine";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-faint">{label}</span>
      {children}
    </label>
  );
}

export function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${ok ? "bg-ok/20 text-ok" : "bg-crimson/20 text-crimson"}`}>
        {ok ? <Check className="size-3" /> : <X className="size-3" />}
      </span>
      <span className="text-muted">{label}</span>
    </li>
  );
}

export function StatePill({ state, compact }: { state: VanityState; compact?: boolean }) {
  const tone =
    state === VanityState.SUCCESS ? "bg-ok/15 text-ok border-ok/40"
    : state === VanityState.FAILED ? "bg-crimson/10 text-crimson border-crimson/40"
    : state === VanityState.CANCELLED ? "bg-warn/10 text-warn border-warn/40"
    : state === VanityState.IDLE ? "bg-raised/60 text-faint border-line"
    : "bg-acid/10 text-acid border-acid/40";
  return (
    <span className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${tone} ${compact ? "" : "inline-flex items-center gap-1.5"}`}>
      {state}
    </span>
  );
}

export function ErrorLine({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-[13px] text-crimson">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" /> {text}
    </p>
  );
}

export function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[12px] ${
        done ? "border-ok/40 bg-ok/15 text-ok" : active ? "border-acid/50 bg-acid/10 text-acid" : "border-line bg-raised/50 text-faint"
      }`}
    >
      {done ? <Check className="size-3.5" /> : String(n).padStart(2, "0")}
    </span>
  );
}
