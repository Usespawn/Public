"use client";

/**
 * SpawnPad launch wizard orchestrator — 7 steps, explicit vanity state machine.
 * No launch is possible without a verified Spw mint (enforced by step flow and
 * re-asserted at transaction build time).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { VanityGrinder, GrindExhaustedError } from "@/lib/vanity/grinder";
import { VanityState, VanityMachine } from "@/lib/vanity/state-machine";
import { MANDATORY_SUFFIX, isSpawnVanityAddress, getNetwork } from "@/lib/config";
import {
  buildCreateTransaction,
  signAndSubmit,
  confirmLaunch,
  verifyLaunchOnChain,
} from "@/lib/launch/launch";
import { uploadMetadataToIpfs } from "@/lib/metadata/upload-client";
import { isIpfsHttpsUrl, isPlausibleCid } from "@/lib/metadata/upload";
import { StepBadge, StatePill } from "./ui";
import { StepInfoForm, type TokenInfo } from "./StepInfoForm";
import { StepVanity } from "./StepVanity";
import { StepValidate, StepConfigure } from "./StepValidate";
import { StepReview } from "./StepReview";
import { StepExecute, StepSuccess } from "./StepExecute";

const STEP_LABELS = [
  "Token info",
  "Generate Spw mint",
  "Validate mint",
  "Configure",
  "Review & approve",
  "Execute",
  "Success",
];

const EMPTY_INFO: TokenInfo = {
  name: "", symbol: "", description: "", website: "", x: "", telegram: "",
  imageCid: null, imageUrl: null,
};

export function LaunchWizard() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const machine = useRef(new VanityMachine());
  const grinder = useRef(new VanityGrinder());

  const [step, setStep] = useState(0);
  const [info, setInfoState] = useState<TokenInfo>(EMPTY_INFO);
  const [state, setState] = useState<VanityState>(VanityState.IDLE);
  const [workerCount, setWorkerCount] = useState(2);
  const [progress, setProgress] = useState({ attempts: 0, aps: 0, elapsed: 0 });
  const [mint58, setMint58] = useState<string | null>(null);
  const [mintKeypair, setMintKeypair] = useState<Keypair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);

  const setInfo = useCallback((patch: Partial<TokenInfo>) => {
    setInfoState((prev) => ({ ...prev, ...patch }));
  }, []);

  const transition = useCallback((to: VanityState) => {
    machine.current.transition(to);
    setState(to);
  }, []);

  const startGrind = useCallback(async () => {
    setError(null);
    setSignature(null);
    setBackendStatus(null);
    transition(VanityState.GENERATING);
    try {
      const res = await grinder.current.grind({
        suffix: MANDATORY_SUFFIX,
        workerCount,
        onProgress: (p) =>
          setProgress({ attempts: p.attempts, aps: p.attemptsPerSecond, elapsed: p.elapsedMs }),
      });
      transition(VanityState.GENERATED);
      setMint58(res.address);
      setMintKeypair(res.mint);
      transition(VanityState.VALIDATING);
      await new Promise((r) => setTimeout(r, 400));
      const ok = isSpawnVanityAddress(res.address) && res.mint.publicKey.toBase58() === res.address;
      if (!ok) {
        transition(VanityState.FAILED);
        setError("mint failed independent validation");
        return;
      }
      transition(VanityState.READY_TO_LAUNCH);
      setStep(2);
    } catch (e: any) {
      if (e.name === "AbortError") {
        transition(VanityState.CANCELLED);
      } else if (e instanceof GrindExhaustedError) {
        transition(VanityState.FAILED);
        setError(`exhausted ${e.attempts.toLocaleString()} attempts without a match — try again`);
      } else {
        transition(VanityState.FAILED);
        setError(String(e?.message || e));
      }
    }
  }, [transition, workerCount]);

  const cancelGrind = useCallback(() => {
    grinder.current.cancel();
    transition(VanityState.CANCELLED);
  }, [transition]);

  const executeLaunch = useCallback(async () => {
    if (!publicKey || !signTransaction || !mintKeypair || !mint58) {
      setError("connect a wallet first");
      return;
    }
    if (!info.imageCid || !info.imageUrl) {
      setError("token image must be uploaded to IPFS before launching");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const bal = await connection.getBalance(publicKey);
      if (bal < 0.05 * LAMPORTS_PER_SOL) {
        throw new Error(
          `insufficient SOL: ${(bal / LAMPORTS_PER_SOL).toFixed(4)} (need ≥ 0.05 for rent + fees)`
        );
      }
      transition(VanityState.LAUNCHING);

      // Metadata upload — happens on this explicit user action, BEFORE the tx
      // is built. Any failure here aborts without broadcasting anything.
      const meta = await uploadMetadataToIpfs({
        name: info.name.trim(),
        symbol: info.symbol.trim().toUpperCase(),
        description: info.description,
        imageUrl: info.imageUrl,
        website: info.website || undefined,
        x: info.x || undefined,
        telegram: info.telegram || undefined,
      });

      // Validate the final metadata URI before it enters the transaction.
      const metadataUri = meta.url;
      if (!isIpfsHttpsUrl(metadataUri) || !isPlausibleCid(meta.cid)) {
        throw new Error("metadata upload returned an invalid URI — launch blocked");
      }

      const { blockhash } = await connection.getLatestBlockhash("finalized");
      const tx = await buildCreateTransaction(
        {
          name: info.name.trim(),
          symbol: info.symbol.trim().toUpperCase(),
          uri: metadataUri,
          payer: publicKey,
          mintKeypair,
        },
        { recentBlockhash: blockhash }
      );
      const sig = await signAndSubmit(tx, mintKeypair, { signTransaction }, connection);
      setSignature(sig);
      transition(VanityState.CONFIRMING);
      await confirmLaunch(connection, sig);
      await verifyLaunchOnChain(mint58, sig);
      transition(VanityState.SUCCESS);
      setStep(6);

      setBackendStatus("recording…");
      try {
        const r = await fetch("/api/launches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mint: mint58,
            signature: sig,
            name: info.name.trim(),
            symbol: info.symbol.trim().toUpperCase(),
            creator: publicKey.toBase58(),
            network: getNetwork(),
          }),
        });
        const d = await r.json();
        setBackendStatus(d.ok ? "verified & recorded" : `not recorded: ${d.error}`);
      } catch (e: any) {
        setBackendStatus(`record failed: ${String(e?.message || e)}`);
      }
    } catch (e: any) {
      transition(VanityState.FAILED);
      setError(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }, [publicKey, signTransaction, mintKeypair, mint58, connection, info, transition]);

  const reset = useCallback(() => {
    machine.current = new VanityMachine();
    grinder.current.terminate();
    setState(VanityState.IDLE);
    setMint58(null);
    setMintKeypair(null);
    setSignature(null);
    setError(null);
    setBackendStatus(null);
    setProgress({ attempts: 0, aps: 0, elapsed: 0 });
    setInfo(EMPTY_INFO);
    setStep(0);
  }, []);

  const eta = useMemo(() => {
    const estimate = Math.pow(58, MANDATORY_SUFFIX.length);
    return progress.aps > 0 ? Math.round(estimate / progress.aps) : null;
  }, [progress.aps]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="glass rounded-2xl px-5 py-4 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 pb-1">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <StepBadge n={i + 1} done={i < step} active={i === step} />
                <span className={`whitespace-nowrap font-mono text-[12px] ${i === step ? "text-ink" : "text-faint"}`}>
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && <span className="text-faint">→</span>}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <StepInfoForm info={info} setInfo={setInfo} connected={connected} onContinue={() => setStep(1)} />
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <StepVanity
                state={state}
                workerCount={workerCount}
                setWorkerCount={setWorkerCount}
                progress={progress}
                mint58={mint58}
                error={error}
                onStart={startGrind}
                onCancel={cancelGrind}
                onContinue={() => setStep(2)}
              />
            </motion.div>
          )}
          {step === 2 && mint58 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <StepValidate mint58={mint58} onContinue={() => setStep(3)} />
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="s4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <StepConfigure onContinue={() => setStep(4)} />
            </motion.div>
          )}
          {step === 4 && mint58 && (
            <motion.div key="s5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <StepReview
                name={info.name}
                symbol={info.symbol}
                mint58={mint58}
                wallet58={publicKey?.toBase58() ?? null}
                onBack={() => setStep(3)}
                onApprove={() => setStep(5)}
              />
            </motion.div>
          )}
          {step === 5 && (
            <motion.div key="s6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <StepExecute
                state={state}
                submitting={submitting}
                signature={signature}
                error={error}
                onSubmit={executeLaunch}
                onBack={() => setStep(4)}
              />
            </motion.div>
          )}
          {step === 6 && mint58 && (
            <motion.div key="s7" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <StepSuccess
                name={info.name}
                symbol={info.symbol}
                mint58={mint58}
                signature={signature}
                backendStatus={backendStatus}
                onReset={reset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live preview */}
      <div className="self-start space-y-4 lg:sticky lg:top-24">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[12px] uppercase tracking-wider text-faint">Live preview</h3>
            <StatePill state={state} compact />
          </div>
          <div className="mt-4 grid size-16 place-items-center rounded-2xl bg-acid/15 font-display text-2xl font-bold text-acid">
            {(info.symbol || "SP").slice(0, 2)}
          </div>
          <div className="mt-3 font-display text-lg font-bold">{info.name || "Token name"}</div>
          <div className="font-mono text-[13px] text-muted">${info.symbol || "TICKER"}</div>
          {info.description && <p className="mt-2 text-[13px] text-muted">{info.description.slice(0, 140)}</p>}
          <div className="mt-4 space-y-1.5 font-mono text-[12px]">
            <div className="flex justify-between gap-2">
              <span className="text-faint">mint</span>
              <span className={mint58 ? "text-acid" : "text-faint"}>
                {mint58 ? `${mint58.slice(0, 6)}…${mint58.slice(-6)}` : "not generated"}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-faint">network</span><span>Solana {getNetwork()}</span></div>
            <div className="flex justify-between gap-2">
              <span className="text-faint">creator</span>
              <span className="text-faint">
                {publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "connect wallet"}
              </span>
            </div>
          </div>
        </div>
        {eta !== null && state === VanityState.GENERATING && (
          <div className="glass rounded-2xl p-4 font-mono text-[12px] text-muted">
            grinding est. remaining ≈ {eta}s — rough estimate, not a guarantee
          </div>
        )}
      </div>
    </div>
  );
}
