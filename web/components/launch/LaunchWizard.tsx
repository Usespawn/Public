"use client";

/**
 * SpawnPad public launch flow â€” single page.
 *
 * Token info + optional DEV BUY + "Launch Token". The Spw vanity mint is
 * generated AUTOMATICALLY in the background (Web Workers, conservative count)
 * when the user launches; the vanity console, worker settings, attempt
 * counters, logs and keypair material are never shown to the public.
 *
 * Transaction shape: official pump.fun create_v2 (plus buy_v2 when the dev
 * buy is on) in ONE atomic transaction, built client-side with the ground
 * mint keypair, partial-signed by it and signed/broadcast by the creator's
 * connected wallet. Results are verified on-chain before success is shown.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import type BN from "bn.js";
import type { Global } from "@pump-fun/pump-sdk";
import { VanityGrinder } from "@/lib/vanity/grinder";
import { VanityState, VanityMachine } from "@/lib/vanity/state-machine";
import { MANDATORY_SUFFIX, isSpawnVanityAddress, getNetwork } from "@/lib/config";
import {
  buildCreateTransaction,
  buildCreateAndBuyTransaction,
  buildStandaloneBuyTransaction,
  fetchBuyStateFor,
  fetchPumpGlobal,
  computeExpectedTokens,
  signLaunch,
  signBuyTransaction,
  submitLaunch,
  confirmLaunch,
  verifyLaunchOnChain,
  verifyDevBuyOnChain,
  LaunchTxTooLargeError,
} from "@/lib/launch/launch";
import {
  validateDevBuyAmount,
  estimateDevBuyTotals,
  formatSol,
  type DevBuyValidation,
} from "@/lib/launch/devbuy";
import { uploadMetadataToIpfs } from "@/lib/metadata/upload-client";
import { isIpfsHttpsUrl, isPlausibleCid } from "@/lib/metadata/upload";
import { StepInfoForm, isInfoValid, type TokenInfo } from "./StepInfoForm";
import { DevBuyPanel } from "./DevBuyPanel";
import { LaunchProgress, type LaunchPhase } from "./LaunchProgress";
import { SuccessScreen, type DevBuyResultView } from "./SuccessScreen";
import { ErrorLine, StatePill } from "./ui";

const EMPTY_INFO: TokenInfo = {
  name: "", symbol: "", description: "", website: "", x: "", telegram: "",
  imageCid: null, imageUrl: null,
};

const DEFAULT_DEV_BUY_SOL = 0.05;

/** Display helper: pump.fun tokens use 6 decimals. */
function formatTokens(amt: BN): string {
  const whole = Number(amt.toString());
  const tokens = whole / 1e6;
  if (tokens >= 1000) return tokens.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (tokens >= 1) return tokens.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return tokens.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function LaunchWizard() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const machine = useRef(new VanityMachine());
  const grinder = useRef(new VanityGrinder());
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const sentAtRef = useRef<number | null>(null);
  const globalCache = useRef<Global | null>(null);

  const [info, setInfoState] = useState<TokenInfo>(EMPTY_INFO);
  const [devBuyEnabled, setDevBuyEnabled] = useState(false);
  const [devBuySol, setDevBuySol] = useState<number>(DEFAULT_DEV_BUY_SOL);
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<{ tokens: string | null; loading: boolean; error: string | null }>({
    tokens: null, loading: false, error: null,
  });

  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [grind, setGrind] = useState({ attempts: 0, aps: 0, elapsed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [buySignature, setBuySignature] = useState<string | null>(null);
  const [mint58, setMint58] = useState<string | null>(null);
  const [devBuyResult, setDevBuyResult] = useState<DevBuyResultView>({
    enabled: false, solSpentSol: null, tokensReceived: null,
  });

  const inFlight = phase !== "idle" && phase !== "success";

  const setInfo = useCallback((patch: Partial<TokenInfo>) => {
    setInfoState((prev) => ({ ...prev, ...patch }));
  }, []);

  const transition = useCallback((to: VanityState) => {
    machine.current.transition(to);
  }, []);

  // Wallet balance (also re-fetched when a flow ends or fails).
  const refreshBalance = useCallback(async () => {
    if (!publicKey) {
      setBalanceLamports(null);
      return;
    }
    try {
      setBalanceLamports(await connection.getBalance(publicKey));
    } catch {
      setBalanceLamports(null);
    }
  }, [connection, publicKey]);
  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance, phase]);

  // Dev buy validation (panel + launch button gating).
  const devBuyValidation = useMemo(() => {
    if (!devBuyEnabled) return { ok: true as const };
    return validateDevBuyAmount(devBuySol, balanceLamports);
  }, [devBuyEnabled, devBuySol, balanceLamports]);

  // Live token estimate for the panel (debounced; the exact quote is
  // recomputed at transaction build time — this number is informational only).
  useEffect(() => {
    if (!devBuyEnabled || !connected) {
      setEstimate({ tokens: null, loading: false, error: null });
      return;
    }
    const v = validateDevBuyAmount(devBuySol, null);
    const vLamports = v.lamports;
    if (!v.ok || vLamports == null) {
      setEstimate({ tokens: null, loading: false, error: null });
      return;
    }
    setEstimate((e) => ({ ...e, loading: true, error: null }));
    const t = setTimeout(() => {
      void (async () => {
        try {
          if (!globalCache.current) globalCache.current = await fetchPumpGlobal(connection);
          const amt = await computeExpectedTokens(globalCache.current, vLamports);
          setEstimate({ tokens: formatTokens(amt), loading: false, error: null });
        } catch {
          setEstimate({
            tokens: null,
            loading: false,
            error: "live quote unavailable — the exact amount is computed at launch",
          });
        }
      })();
    }, 500);
    return () => clearTimeout(t);
  }, [devBuyEnabled, devBuySol, connected, connection]);

  const launch = useCallback(async () => {
    // Duplicate-submission guard (double click, re-entrancy).
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;
    sentAtRef.current = null;
    setError(null);
    setSignature(null);
    setBuySignature(null);
    setSubmitted(false);
    setDevBuyResult({ enabled: devBuyEnabled, solSpentSol: null, tokensReceived: null });
    try {
      // ---- 1. Validation --------------------------------------------------
      if (!connected || !publicKey || !signTransaction) {
        throw new Error("connect a Solana wallet first");
      }
      if (!isInfoValid(info)) {
        throw new Error("complete the token information and upload the image first");
      }
      const devVal: DevBuyValidation = devBuyEnabled
        ? validateDevBuyAmount(devBuySol, balanceLamports)
        : { ok: true };
      if (!devVal.ok || (devBuyEnabled && !devVal.lamports)) {
        throw new Error(devVal.error ?? "invalid dev buy amount");
      }

      // ---- 2. Automatic vanity generation (background workers) ------------
      transition(VanityState.GENERATING);
      setPhase("grinding");
      setGrind({ attempts: 0, aps: 0, elapsed: 0 });
      const res = await grinder.current.grind({
        suffix: MANDATORY_SUFFIX,
        // Conservative automatic worker count — never a user setting.
        workerCount:
          typeof navigator !== "undefined" && navigator.hardwareConcurrency
            ? Math.max(2, Math.min(4, Math.floor(navigator.hardwareConcurrency / 2)))
            : 2,
        onProgress: (p) => setGrind({ attempts: p.attempts, aps: p.attemptsPerSecond, elapsed: p.elapsedMs }),
      });
      if (cancelledRef.current) return;
      // Independent re-verification — never trust the worker blindly.
      if (!(isSpawnVanityAddress(res.address) && res.mint.publicKey.toBase58() === res.address)) {
        throw new Error("generated mint failed independent validation");
      }
      transition(VanityState.GENERATED);
      transition(VanityState.VALIDATING);
      transition(VanityState.READY_TO_LAUNCH);
      setMint58(res.address);

      // ---- 3. Preparing launch transaction --------------------------------
      setPhase("preparing");
      setSubStatus("uploading metadata…");
      if (!info.imageCid || !info.imageUrl) {
        throw new Error("token image must be uploaded to IPFS before launching");
      }
      const meta = await uploadMetadataToIpfs({
        name: info.name.trim(),
        symbol: info.symbol.trim().toUpperCase(),
        description: info.description,
        imageUrl: info.imageUrl,
        website: info.website || undefined,
        x: info.x || undefined,
        telegram: info.telegram || undefined,
      });
      if (cancelledRef.current) return;
      const metadataUri = meta.url;
      if (!isIpfsHttpsUrl(metadataUri) || !isPlausibleCid(meta.cid)) {
        throw new Error("metadata upload returned an invalid URI — launch blocked");
      }

      setSubStatus("building transaction…");
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      const common = {
        name: info.name.trim(),
        symbol: info.symbol.trim().toUpperCase(),
        uri: metadataUri,
        payer: publicKey,
        mintKeypair: res.mint,
      };
      let tx: Transaction | null = null;
      let viaTwoStage = false;
      if (devBuyEnabled && devVal.lamports) {
        // ATOMIC create + initial buy (official create_v2 + buy_v2 bundle).
        if (!globalCache.current) globalCache.current = await fetchPumpGlobal(connection);
        if (cancelledRef.current) return;
        try {
          tx = await buildCreateAndBuyTransaction(
            { ...common, devBuyLamports: devVal.lamports, global: globalCache.current },
            { recentBlockhash: blockhash }
          );
        } catch (e) {
          if (e instanceof LaunchTxTooLargeError) {
            // The combined transaction cannot fit Solana's hard 1232-byte
            // packet limit. It was REJECTED BEFORE SUBMISSION — never signed,
            // never broadcast. Switch to the official two-stage flow: create
            // first (always fits), confirm it, then a separate dev buy.
            viaTwoStage = true;
            tx = null;
            setSubStatus(
              "combined create + dev buy transaction exceeds the network's " +
                `${(e as LaunchTxTooLargeError).wireSize} > 1232 byte limit — ` +
                "switching to create first, dev buy separately…"
            );
          } else {
            throw e;
          }
        }
      } else {
        tx = await buildCreateTransaction(common, { recentBlockhash: blockhash });
      }
      // Two-stage fallback: build the create-only transaction (it keeps its
      // compute-budget instructions and always fits the packet limit).
      if (tx === null) {
        tx = await buildCreateTransaction(common, { recentBlockhash: blockhash });
      }
      if (cancelledRef.current) return;

      // ---- 4. Waiting for wallet confirmation -----------------------------
      setSubStatus("approve the transaction in your wallet");
      setPhase("wallet");
      transition(VanityState.LAUNCHING);
      const raw = await signLaunch(tx, res.mint, { signTransaction });
      if (cancelledRef.current) return;

      // ---- 5. Launching (broadcast + confirm) ------------------------------
      setPhase("submitting");
      setSubStatus("broadcasting to the network…");
      // From here the launch is committed: no cancel, no resubmit.
      setSubmitted(true);
      const sig = await submitLaunch(raw, connection);
      sentAtRef.current = Date.now();
      setSignature(sig);
      setSubStatus("waiting for on-chain confirmation…");
      transition(VanityState.CONFIRMING);
      await confirmLaunch(connection, sig);

      // ---- 6. Verified on-chain -------------------------------------------
      setSubStatus("verifying the launch on-chain…");
      await verifyLaunchOnChain(res.address, sig);

      let devResult: DevBuyResultView = {
        enabled: devBuyEnabled, solSpentSol: null, tokensReceived: null,
      };
      let buySigLocal: string | null = null;
      if (devBuyEnabled && viaTwoStage) {
        // TWO-STAGE flow: the token creation is already CONFIRMED and
        // verified. The dev buy is its own transaction — submit, confirm and
        // verify it independently. A buy failure NEVER invalidates the
        // creation and is NEVER reported as success.
        try {
          setSubStatus("token created — preparing the dev buy…");
          const buyState = await fetchBuyStateFor(res.address, publicKey, connection);
          if (cancelledRef.current) return;
          const { blockhash: buyBlockhash } = await connection.getLatestBlockhash("finalized");
          const buyTx = await buildStandaloneBuyTransaction(
            {
              mint58: res.address,
              user: publicKey,
              devBuyLamports: devVal.lamports!,
              global: globalCache.current!,
              buyState,
            },
            { recentBlockhash: buyBlockhash }
          );
          setSubStatus("approve the dev buy in your wallet");
          const buyRaw = await signBuyTransaction(buyTx, { signTransaction });
          setPhase("submitting");
          setSubStatus("broadcasting the dev buy…");
          buySigLocal = await submitLaunch(buyRaw, connection);
          setBuySignature(buySigLocal);
          setSubStatus("confirming the dev buy…");
          await confirmLaunch(connection, buySigLocal);
          setSubStatus("verifying the dev buy on-chain…");
          const vdb = await verifyDevBuyOnChain(res.address, publicKey.toBase58(), buySigLocal);
          devResult = {
            enabled: true,
            viaTwoStage: true,
            buySignature: buySigLocal,
            solSpentSol: vdb.solSpentLamports != null ? formatSol(vdb.solSpentLamports) : null,
            tokensReceived:
              vdb.tokensReceived != null
                ? vdb.tokensReceived.toLocaleString("en-US", { maximumFractionDigits: 2 })
                : null,
          };
        } catch (buyErr) {
          // Preserve the confirmed creation; report the buy failure
          // separately. No automatic retry — the next buy must be a
          // deliberate user action (pump.fun or a fresh SpawnPad launch).
          const bmsg = buyErr instanceof Error ? buyErr.message : String(buyErr);
          devResult = {
            enabled: true,
            viaTwoStage: true,
            failed: true,
            error: bmsg,
            buySignature: buySigLocal,
            solSpentSol: null,
            tokensReceived: null,
          };
        }
      } else if (devBuyEnabled) {
        // ATOMIC flow: create + buy share one transaction and one outcome;
        // verification of that transaction covers both.
        const vdb = await verifyDevBuyOnChain(res.address, publicKey.toBase58(), sig);
        devResult = {
          enabled: true,
          solSpentSol: vdb.solSpentLamports != null ? formatSol(vdb.solSpentLamports) : null,
          tokensReceived:
            vdb.tokensReceived != null
              ? vdb.tokensReceived.toLocaleString("en-US", { maximumFractionDigits: 2 })
              : null,
        };
      }
      setDevBuyResult(devResult);
      transition(VanityState.SUCCESS);
      setPhase("success");

      // Best-effort backend recording AFTER verified success (non-blocking).
      void fetch("/api/launches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: res.address,
          signature: sig,
          name: info.name.trim(),
          symbol: info.symbol.trim().toUpperCase(),
          creator: publicKey.toBase58(),
          network: getNetwork(),
        }),
      }).catch(() => undefined);
    } catch (e: unknown) {
      if (cancelledRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (submitted) {
        // Post-submission: outcome undetermined — monitoring only, never retry.
        setError(`launch could not be verified: ${msg}`);
        setPhase("submitting");
      } else {
        transition(VanityState.FAILED);
        setError(msg);
        // Stay on the failing stage; "Try again" restarts the flow.
      }
    } finally {
      runningRef.current = false;
    }
  }, [
    connected, publicKey, signTransaction, connection, info,
    devBuyEnabled, devBuySol, balanceLamports, transition, submitted,
  ]);

  const cancelLaunch = useCallback(() => {
    cancelledRef.current = true;
    grinder.current.cancel();
    try {
      transition(VanityState.CANCELLED);
      transition(VanityState.IDLE);
    } catch {
      machine.current = new VanityMachine();
    }
    setPhase("idle");
    setError("Launch cancelled — nothing was submitted.");
  }, [transition]);

  const retryLaunch = useCallback(() => {
    try {
      if (machine.current.state !== VanityState.IDLE) transition(VanityState.IDLE);
    } catch {
      machine.current = new VanityMachine();
    }
    setPhase("idle");
    setError(null);
    void launch();
  }, [launch, transition]);

  /**
   * Verification-only recheck after broadcast. NEVER resubmits — the signed
   * payload is not even kept. If the transaction was never accepted by the
   * network (e.g. the RPC dropped the send) and enough time has passed, the
   * flow is explicitly reset to a safe retry.
   */
  const recheckLaunch = useCallback(async () => {
    if (!signature) return;
    setRechecking(true);
    setError(null);
    try {
      const status = await connection.getSignatureStatuses([signature]);
      const s = status.value[0];
      if (!s) {
        const waited = sentAtRef.current != null && Date.now() - sentAtRef.current > 30_000;
        if (waited) {
          setSubmitted(false);
          setError("the transaction was never accepted by the network — safe to try again");
        } else {
          setError("not confirmed yet — still processing, check again shortly");
        }
        return;
      }
      if (s.err) {
        setError(`the transaction failed on-chain: ${JSON.stringify(s.err)}`);
        return;
      }
      if (s.confirmationStatus !== "confirmed" && s.confirmationStatus !== "finalized") {
        setError("still processing — check again shortly");
        return;
      }
      await verifyLaunchOnChain(mint58 ?? "", signature);
      // If the dev buy ran as a separate transaction, re-verify it too. The
      // atomic bundle needs no second check (one tx = one outcome).
      if (buySignature) {
        try {
          const vdb = await verifyDevBuyOnChain(
            mint58 ?? "",
            publicKey?.toBase58() ?? "",
            buySignature
          );
          setDevBuyResult({
            enabled: true,
            viaTwoStage: true,
            buySignature,
            solSpentSol: vdb.solSpentLamports != null ? formatSol(vdb.solSpentLamports) : null,
            tokensReceived:
              vdb.tokensReceived != null
                ? vdb.tokensReceived.toLocaleString("en-US", { maximumFractionDigits: 2 })
                : null,
          });
        } catch {
          // Keep the failed state visible — the recheck never fabricates success.
        }
      }
      transition(VanityState.CONFIRMING);
      transition(VanityState.SUCCESS);
      setPhase("success");
      void refreshBalance();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Distinguish "not found yet" from a hard failure.
      if (msg.includes("not found") || msg.includes("404")) {
        setError("not confirmed yet — still processing, check again shortly");
      } else {
        setError(`verification failed: ${msg}`);
      }
    } finally {
      setRechecking(false);
    }
  }, [signature, buySignature, connection, mint58, transition, refreshBalance]);

  const reset = useCallback(() => {
    machine.current = new VanityMachine();
    grinder.current.terminate();
    cancelledRef.current = false;
    runningRef.current = false;
    sentAtRef.current = null;
    globalCache.current = null;
    setPhase("idle");
    setSubStatus(null);
    setGrind({ attempts: 0, aps: 0, elapsed: 0 });
    setMint58(null);
    setSignature(null);
    setBuySignature(null);
    setError(null);
    setSubmitted(false);
    setDevBuyResult({ enabled: false, solSpentSol: null, tokensReceived: null });
    setInfoState(EMPTY_INFO);
  }, []);

  /**
   * Verification-only recheck of a FAILED two-stage dev buy (read-only RPC).
   * NEVER re-broadcasts and never signs anything — the user's next purchase
   * must be a deliberate action, so an automatic retry (and any chance of an
   * unintended duplicate buy) is structurally impossible here.
   */
  const recheckBuy = useCallback(async () => {
    if (!buySignature || !mint58) return;
    setRechecking(true);
    try {
      const vdb = await verifyDevBuyOnChain(
        mint58,
        publicKey?.toBase58() ?? "",
        buySignature
      );
      setDevBuyResult({
        enabled: true,
        viaTwoStage: true,
        buySignature,
        solSpentSol: vdb.solSpentLamports != null ? formatSol(vdb.solSpentLamports) : null,
        tokensReceived:
          vdb.tokensReceived != null
            ? vdb.tokensReceived.toLocaleString("en-US", { maximumFractionDigits: 2 })
            : null,
      });
    } catch {
      // Still not verifiable — the failed state stays.
    } finally {
      setRechecking(false);
    }
  }, [buySignature, mint58, publicKey]);

  const clusterQuery = getNetwork() === "mainnet-beta" ? "" : "?cluster=devnet";
  const launchReady = connected && isInfoValid(info) && devBuyValidation.ok;

  // ---- Render ----------------------------------------------------------------
  if (phase === "success" && mint58) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SuccessScreen
          name={info.name.trim()}
          symbol={info.symbol.trim().toUpperCase()}
          mint58={mint58}
          creator58={publicKey?.toBase58() ?? null}
          signature={signature}
          buySignature={buySignature}
          devBuy={devBuyResult}
          clusterQuery={clusterQuery}
          onReset={reset}
          onRecheckBuy={() => void recheckBuy()}
          recheckingBuy={rechecking}
        />
      </div>
    );
  }

  if (phase !== "idle") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <LaunchProgress
          phase={phase}
          subStatus={subStatus}
          grind={grind}
          error={error}
          submitted={submitted}
          signature={signature}
          buySignature={buySignature}
          clusterQuery={clusterQuery}
          onCancel={cancelLaunch}
          onRetry={retryLaunch}
          onRecheck={() => void recheckLaunch()}
          rechecking={rechecking}
        />
        <div className="self-start space-y-4 lg:sticky lg:top-24">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[12px] uppercase tracking-wider text-faint">Live preview</h3>
            </div>
            <div className="mt-4 grid size-16 place-items-center rounded-2xl bg-acid/15 font-display text-2xl font-bold text-acid">
              {(info.symbol || "SP").slice(0, 2)}
            </div>
            <div className="mt-3 font-display text-lg font-bold">{info.name || "Token name"}</div>
            <div className="font-mono text-[13px] text-muted">${info.symbol || "TICKER"}</div>
            <div className="mt-4 space-y-1.5 font-mono text-[12px]">
              <div className="flex justify-between">
                <span className="text-faint">mint</span>
                <span className="text-faint">generating…</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">network</span>
                <span>Solana {getNetwork()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-faint">dev buy</span>
                <span className="text-ink">{devBuyEnabled ? `${devBuySol} SOL` : "off"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Single-page launch form ------------------------------------------------
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <StepInfoForm info={info} setInfo={setInfo} connected={connected} />

        <DevBuyPanel
          enabled={devBuyEnabled}
          onToggle={setDevBuyEnabled}
          amountSol={devBuySol}
          onSelectPreset={setDevBuySol}
          onCustomChange={setDevBuySol}
          wallet58={publicKey?.toBase58() ?? null}
          balanceLamports={balanceLamports}
          estimateTokens={estimate.tokens}
          estimateLoading={estimate.loading}
          estimateError={estimate.error}
          validationError={devBuyEnabled && !devBuyValidation.ok ? devBuyValidation.error ?? null : null}
          onRefreshBalance={() => void refreshBalance()}
          disabled={inFlight}
        />

        {/* Launch */}
        <div className="glass rounded-2xl p-6 space-y-3">
          <h2 className="font-display text-lg font-bold">03 · Launch</h2>
          <p className="text-[13px] leading-relaxed text-muted">
            One click does everything: SpawnPad quietly generates your{" "}
            <span className="font-mono font-semibold text-acid">{MANDATORY_SUFFIX}</span> mint in
            the background, pins the metadata, builds the official pump.fun
            {devBuyEnabled ? " create + buy" : ""} transaction and asks you to approve it.
            Your keys never leave this device.
          </p>
          {!connected && (
            <p className="text-[12.5px] text-warn">Connect your wallet to launch.</p>
          )}
          {connected && !isInfoValid(info) && (
            <p className="text-[12.5px] text-warn">
              Add a name, symbol and an uploaded image to enable launch.
            </p>
          )}
          {devBuyEnabled && !devBuyValidation.ok && (
            <p className="text-[12.5px] text-crimson">{devBuyValidation.error}</p>
          )}
          {error && <ErrorLine text={error} />}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void launch()}
              disabled={!launchReady || inFlight}
              className="rounded-full bg-acid px-8 py-3 font-mono text-[14px] font-bold text-obsidian shadow-glow transition-colors hover:bg-[#7DF0FF] disabled:bg-raised/60 disabled:text-faint disabled:shadow-none"
            >
              Launch Token →
            </button>
            {devBuyEnabled && (
              <span className="font-mono text-[12px] text-faint">
                dev buy {devBuySol} SOL + ≈ {formatSol(estimateDevBuyTotals(devBuySol).overheadLamports)} SOL
                fees · total ≈ {formatSol(estimateDevBuyTotals(devBuySol).totalLamports)} SOL
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="self-start space-y-4 lg:sticky lg:top-24">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[12px] uppercase tracking-wider text-faint">Live preview</h3>
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
              <span className="text-acid">ends in {MANDATORY_SUFFIX}</span>
            </div>
            <div className="flex justify-between"><span className="text-faint">network</span><span>Solana {getNetwork()}</span></div>
            <div className="flex justify-between gap-2">
              <span className="text-faint">creator</span>
              <span className="text-faint">
                {publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "connect wallet"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">dev buy</span>
              <span className="text-ink">{devBuyEnabled ? `${devBuySol} SOL` : "off"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

