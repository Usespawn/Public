"use client";

/**
 * SpawnPad interactive terminal — genuine frontend command parser with
 * predefined safe commands. Never evaluates input, never touches server
 * env, never fabricates on-chain results. Status values come from real
 * sources (build constants + live RPC health check) or are shown as UNKNOWN.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Copy, Trash2, TerminalSquare } from "lucide-react";
import { getNetwork, getRpcUrl, MANDATORY_SUFFIX } from "@/lib/config";

const APP_VERSION = "1.0.0";
const ENGINE = "official pump.fun create_v2 · @pump-fun/pump-sdk 4.1.0";

type Tone = "out" | "cmd" | "ok" | "err" | "dim";
interface Line {
  text: string;
  tone: Tone;
}

const BOOT: Line[] = [
  { text: "SPAWNPAD TERMINAL v1.0", tone: "ok" },
  { text: "", tone: "out" },
  { text: "Initializing SpawnPad interface...", tone: "dim" },
  { text: "Application: SpawnPad", tone: "out" },
  { text: `Network: ${getNetwork()}`, tone: "out" },
  { text: `Launch engine: ${ENGINE}`, tone: "out" },
  { text: `Vanity target: ${MANDATORY_SUFFIX}`, tone: "out" },
  { text: "Mint verification: Ready to check", tone: "out" },
  { text: "", tone: "out" },
  { text: "Type `help` to explore commands.", tone: "dim" },
];

const HELP: string[] = [
  "Available commands:",
  "  help      — list available commands",
  "  about     — what SpawnPad is",
  "  features  — engine, vanity, discovery, signing, verification",
  "  vanity    — how the Spw vanity engine works",
  "  status    — live application / RPC / engine status",
  "  network   — configured Solana network",
  "  docs      — open documentation",
  "  explore   — open token discovery",
  "  launch    — open the launch wizard (starts nothing by itself)",
  "  clear     — clear terminal output",
  "  version   — application version",
];

export function SpawnTerminal() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [lines, setLines] = useState<Line[]>(BOOT);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  const push = useCallback((...ls: Line[]) => setLines((prev) => [...prev, ...ls]), []);
  const print = useCallback((text: string, tone: Tone = "out") => push({ text, tone }), [push]);

  const runStatus = useCallback(async () => {
    setBusy(true);
    print("checking status…", "dim");
    const network = getNetwork();
    print(`application: SpawnPad v${APP_VERSION} — running`, "ok");
    print(`network: ${network}`, "out");
    let rpc: string;
    try {
      const res = await fetch(getRpcUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      rpc = data?.result === "ok" ? `reachable (${getRpcUrl()})` : "responded, unexpected result";
    } catch {
      rpc = "unreachable or timed out — launch actions will fail until RPC is available";
    }
    print(`rpc: ${rpc}`, rpc.startsWith("reachable") ? "ok" : "err");
    print(`launch engine: ${ENGINE}`, "out");
    print(`vanity engine: ${MANDATORY_SUFFIX} grinder — ready (browser-side)`, "ok");
    print(
      connected && publicKey
        ? `wallet: connected (${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)})`
        : "wallet: not connected",
      connected ? "ok" : "dim"
    );
    print("on-chain launch state: nothing launched from this session", "dim");
    setBusy(false);
  }, [connected, publicKey, print]);

  const execute = useCallback(
    async (raw: string) => {
      const cmdline = raw.trim();
      if (!cmdline) return;
      print(`spawnpad > ${cmdline}`, "cmd");
      const cmd = cmdline.split(/\s+/)[0].toLowerCase();
      switch (cmd) {
        case "help":
          HELP.forEach((l) => print(l));
          break;
        case "about":
          print("SpawnPad is a Solana token launchpad built on Pump.fun's official");
          print("bonding-curve engine. Its defining rule: every token launched");
          print(`through SpawnPad uses a real mint address ending in ${MANDATORY_SUFFIX} —`);
          print("ground in your browser, verified on-chain, never faked.");
          break;
        case "features":
          print("launch engine   — official pump.fun create_v2 (user-authorized tx)");
          print("vanity engine   — browser-side Ed25519 keypair grind for …Spw");
          print("discovery       — verified launch feed at /explore (real records only)");
          print("wallet signing  — your wallet signs as fee payer; mint co-signs locally");
          print("verification    — tx + bonding-curve PDA checked on-chain post-confirm");
          break;
        case "vanity":
          print(`the engine generates Solana keypairs until one ends in ${MANDATORY_SUFFIX}.`);
          print("search space: 58^3 ≈ 195,112 (rough estimate, not a guarantee).");
          print("runs in Web Workers off the main thread; cancellable anytime;");
          print("the private key never leaves your browser.");
          break;
        case "status":
          await runStatus();
          break;
        case "network":
          print(`configured network: ${getNetwork()}`, "ok");
          print("mainnet requires deliberate configuration — SpawnPad never switches silently.", "dim");
          break;
        case "docs":
          print("opening /docs…", "dim");
          router.push("/docs");
          break;
        case "explore":
          print("opening /explore…", "dim");
          router.push("/explore");
          break;
        case "launch":
          print("opening the launch wizard — nothing is submitted from the terminal.", "dim");
          router.push("/launch");
          break;
        case "clear":
          setLines([]);
          break;
        case "version":
          print(`SpawnPad v${APP_VERSION} · web (next.js 14 app router)`, "ok");
          break;
        default:
          print(`command not found: ${cmd}`, "err");
          print("type `help` for available commands.", "dim");
      }
    },
    [print, router, runStatus]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !busy) {
      const value = input;
      setInput("");
      if (value.trim()) {
        setHistory((h) => [value, ...h].slice(0, 50));
        setHistoryIdx(-1);
      }
      void execute(value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, history.length - 1);
      if (history[next] !== undefined) {
        setHistoryIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setInput(next >= 0 ? history[next] : "");
    }
  };

  const copyAll = () => navigator.clipboard.writeText(lines.map((l) => l.text).join("\n"));

  const toneClass: Record<Tone, string> = {
    out: "text-ink/85",
    cmd: "text-acid",
    ok: "text-ok",
    err: "text-err",
    dim: "text-muted",
  };

  return (
    <div className="surface relative overflow-hidden rounded-xl shadow-panel">
      {/* Cyan top illumination */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acid/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 -top-10 h-16 rounded-full bg-acid/[0.07] blur-2xl" />

      <div className="relative flex items-center gap-3 border-b border-line bg-raised/70 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#31406a]" />
          <span className="size-2.5 rounded-full bg-[#31406a]" />
          <span className="size-2.5 rounded-full bg-acid/70" />
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-muted">
          <TerminalSquare className="size-3.5 text-acid/80" /> spawnpad — sh
        </span>
        <div className="flex-1" />
        <button onClick={copyAll} title="Copy terminal output" aria-label="Copy terminal output" className="text-faint transition-colors hover:text-acid">
          <Copy className="size-3.5" />
        </button>
        <button onClick={() => setLines([])} title="Clear terminal" aria-label="Clear terminal" className="text-faint transition-colors hover:text-acid">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="relative h-72 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed sm:h-80"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((l, i) => (
          <div key={i} className={`whitespace-pre-wrap break-words ${toneClass[l.tone]}`}>
            {l.text || "\u00A0"}
          </div>
        ))}
        {busy && <div className="text-acid">…</div>}
      </div>

      <div className="relative flex items-center gap-2 border-t border-line bg-raised/70 px-4 py-2.5">
        <span className="font-mono text-[12.5px] text-acid">spawnpad &gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="type help"
          aria-label="Terminal command input"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-ink outline-none placeholder:text-faint"
        />
        <span className="animate-blink font-mono text-acid" aria-hidden="true">▌</span>
      </div>
    </div>
  );
}
