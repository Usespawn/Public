import assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { grindVanityKeypair } from "@spawnpad/vanity-grinder";
import { SpawnpadEngine } from "../target/types/spawnpad_engine";

const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// Test-tuned configuration (graduates at 1.5 SOL for fast tests; production
// defaults live in programs/spawnpad-engine/src/state.rs).
const TOTAL_FEE_BPS = 100; // 1%
const CREATOR_FEE_BPS = 2000; // 20% of the fee
const GRADUATION_THRESHOLD = BigInt(1.5 * LAMPORTS_PER_SOL);

// Pump.fun-style curve constants (mirror of state.rs defaults).
const INITIAL_VIRTUAL_SOL = 30_000_000_000n;
const INITIAL_VIRTUAL_TOKEN = 1_073_000_000_000_000n;
const CURVE_TOKEN_RESERVES = 793_100_000_000_000n;

// TS mirror of curve_math.rs — used to compute exact on-chain expectations.
interface CurveState {
  virtualSol: bigint;
  virtualToken: bigint;
  realSol: bigint;
  realToken: bigint;
}

function freshCurve(): CurveState {
  return {
    virtualSol: INITIAL_VIRTUAL_SOL,
    virtualToken: INITIAL_VIRTUAL_TOKEN,
    realSol: 0n,
    realToken: CURVE_TOKEN_RESERVES,
  };
}

function splitFee(gross: bigint) {
  const totalFee = (gross * BigInt(TOTAL_FEE_BPS)) / 10_000n;
  const creatorFee = (totalFee * BigInt(CREATOR_FEE_BPS)) / 10_000n;
  return { totalFee, creatorFee, protocolFee: totalFee - creatorFee };
}

function quoteBuy(gross: bigint, s: CurveState) {
  const fees = splitFee(gross);
  const net = gross - fees.totalFee;
  const tokensOut = (net * s.virtualToken) / (s.virtualSol + net);
  return { ...fees, net, tokensOut };
}

function applyBuy(gross: bigint, s: CurveState) {
  const q = quoteBuy(gross, s);
  s.virtualSol += q.net;
  s.realSol += q.net;
  s.virtualToken -= q.tokensOut;
  s.realToken -= q.tokensOut;
  return q;
}

function quoteSell(tokensIn: bigint, s: CurveState) {
  const gross = (tokensIn * s.virtualSol) / (s.virtualToken + tokensIn);
  const fees = splitFee(gross);
  return { ...fees, gross, net: gross - fees.totalFee };
}

function applySell(tokensIn: bigint, s: CurveState) {
  const q = quoteSell(tokensIn, s);
  // On-chain: the curve pays out the FULL gross — fees leave the curve.
  s.virtualSol -= q.gross;
  s.realSol -= q.gross;
  s.virtualToken += tokensIn;
  s.realToken += tokensIn;
  return q;
}

describe("spawnpad-engine", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as AnchorProvider;
  const program = anchor.workspace.SpawnpadEngine as Program<SpawnpadEngine>;
  const payer = provider.wallet;

  const feeRecipient = Keypair.generate().publicKey;

  let mint: Keypair;
  let configPda: PublicKey;
  let bondingCurve: PublicKey;
  let curveAuthority: PublicKey;
  let curveTokenAccount: PublicKey;
  let metadataPda: PublicKey;
  const buyer = payer.publicKey;
  let buyerAta: PublicKey;

  // Live TS-mirror of the on-chain curve state.
  let state = freshCurve();

  before(async () => {
    // Self-fund on a hand-rolled localnet (anchor test needs WSL on Windows).
    const bal = await provider.connection.getBalance(payer.publicKey);
    if (bal < 20 * LAMPORTS_PER_SOL) {
      const sig = await provider.connection.requestAirdrop(
        payer.publicKey,
        100 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");
    }

    console.log("  [grinder] mining a ...Spw vanity mint keypair...");
    const res = await grindVanityKeypair({ suffix: "Spw", threads: 4 });
    console.log(
      `  [grinder] ${res.publicKey} — ${res.attempts.toLocaleString()} attempts @ ${res.ratePerSec.toLocaleString()}/s in ${(res.elapsedMs / 1000).toFixed(2)}s`
    );
    mint = Keypair.fromSecretKey(res.secretKey);
    assert.ok(mint.publicKey.toBase58().endsWith("Spw"), "mint must end in Spw");

    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      program.programId
    );
    [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("curve"), mint.publicKey.toBytes()],
      program.programId
    );
    [curveAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("curve_authority"), mint.publicKey.toBytes()],
      program.programId
    );
    curveTokenAccount = getAssociatedTokenAddressSync(mint.publicKey, curveAuthority, true);
    [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), MPL_TOKEN_METADATA_PROGRAM_ID.toBytes(), mint.publicKey.toBytes()],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );
    buyerAta = getAssociatedTokenAddressSync(mint.publicKey, buyer, true);
  });

  it("initializes the global config", async () => {
    await program.methods
      .initialize({
        feeRecipient,
        totalFeeBps: TOTAL_FEE_BPS,
        creatorFeeBps: CREATOR_FEE_BPS,
        graduationThresholdLamports: new BN(GRADUATION_THRESHOLD.toString()),
        initialVirtualSolLamports: new BN(INITIAL_VIRTUAL_SOL.toString()),
        initialVirtualTokenReserves: new BN(INITIAL_VIRTUAL_TOKEN.toString()),
        totalTokenSupply: new BN(CURVE_TOKEN_RESERVES.toString()),
        curveTokenReserves: new BN(CURVE_TOKEN_RESERVES.toString()),
        minSolForBuy: new BN(10_000),
      })
      .accounts({
        admin: payer.publicKey,
        globalConfig: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.globalConfig.fetch(configPda);
    assert.equal(cfg.totalFeeBps, TOTAL_FEE_BPS);
    assert.equal(cfg.creatorFeeBps, CREATOR_FEE_BPS);
    assert.equal(cfg.feeRecipient.toBase58(), feeRecipient.toBase58());
  });

  it("rejects a mint that does NOT end in Spw (on-chain vanity enforcement)", async () => {
    const nonVanity = Keypair.generate();
    const [curvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("curve"), nonVanity.publicKey.toBytes()],
      program.programId
    );
    const [authorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("curve_authority"), nonVanity.publicKey.toBytes()],
      program.programId
    );
    const vault = getAssociatedTokenAddressSync(nonVanity.publicKey, authorityPda, true);
    const [mdPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), MPL_TOKEN_METADATA_PROGRAM_ID.toBytes(), nonVanity.publicKey.toBytes()],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );
    try {
      await program.methods
        .createCurve({ name: "Evil", symbol: "NO", uri: "" })
        .accounts({
          payer: payer.publicKey,
          mint: nonVanity.publicKey,
          globalConfig: configPda,
          bondingCurve: curvePda,
          curveAuthority: authorityPda,
          curveTokenAccount: vault,
          metadata: mdPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([nonVanity])
        .rpc();
      assert.fail("non-vanity mint must be rejected");
    } catch (err: any) {
      assert.ok(
        String(err).includes("NotSpawnVanity") || String(err).includes("vanity"),
        `unexpected error: ${String(err)}`
      );
    }
  });

  it("launches a token on a curve with a ...Spw vanity mint + metadata", async () => {
    const name = "Spawnpad Test Token";
    const symbol = "SPWT";
    const uri = "https://ipfs.io/ipfs/FAKE_METADATA_URI.json";
    await program.methods
      .createCurve({ name, symbol, uri })
      .accounts({
        payer: payer.publicKey,
        mint: mint.publicKey,
        globalConfig: configPda,
        bondingCurve,
        curveAuthority,
        curveTokenAccount,
        metadata: metadataPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    const curve = await program.account.bondingCurve.fetch(bondingCurve);
    assert.equal(curve.mint.toBase58(), mint.publicKey.toBase58());
    assert.equal(curve.creator.toBase58(), payer.publicKey.toBase58());
    assert.equal(curve.virtualSolReserves.toString(), INITIAL_VIRTUAL_SOL.toString());
    assert.equal(curve.virtualTokenReserves.toString(), INITIAL_VIRTUAL_TOKEN.toString());
    assert.equal(curve.realTokenReserves.toString(), CURVE_TOKEN_RESERVES.toString());
    assert.equal(curve.realSolReserves.toString(), "0");
    assert.equal(curve.complete, false);

    // Metadata account was created for the vanity mint.
    const mdRaw = await provider.connection.getAccountInfo(metadataPda);
    assert.ok(mdRaw && mdRaw.data.length > 0, "metadata account should exist");

    // Vault holds the full curve supply.
    const vault = await getAccount(provider.connection, curveTokenAccount);
    assert.equal(vault.amount, CURVE_TOKEN_RESERVES);
  });

  it("buys tokens: exact virtual-reserve pricing + fee split", async () => {
    const gross = BigInt(0.6 * LAMPORTS_PER_SOL);
    const expected = quoteBuy(gross, state);
    const feeRecipientBefore = await provider.connection.getBalance(feeRecipient);

    await program.methods
      .buy(new BN(gross.toString()), new BN((expected.tokensOut - 1n).toString()))
      .accounts({
        buyer,
        globalConfig: configPda,
        bondingCurve,
        curveAuthority,
        mint: mint.publicKey,
        curveTokenAccount,
        buyerTokenAccount: buyerAta,
        feeRecipient,
        creator: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    applyBuy(gross, state);

    const balance = await getAccount(provider.connection, buyerAta);
    assert.equal(
      balance.amount.toString(),
      expected.tokensOut.toString(),
      "buyer token balance must match the virtual-reserve quote exactly"
    );

    const feeRecipientAfter = await provider.connection.getBalance(feeRecipient);
    assert.equal(
      BigInt(feeRecipientAfter - feeRecipientBefore),
      expected.protocolFee,
      "protocol fee must land in fee_recipient"
    );

    const curve = await program.account.bondingCurve.fetch(bondingCurve);
    assert.equal(curve.realSolReserves.toString(), state.realSol.toString());
    assert.equal(curve.realTokenReserves.toString(), state.realToken.toString());
    assert.equal(curve.virtualTokenReserves.toString(), state.virtualToken.toString());
  });

  it("sells tokens: exact pricing, fees leave the curve", async () => {
    const holdings = (await getAccount(provider.connection, buyerAta)).amount;
    const tokensIn = holdings / 3n;
    const expected = quoteSell(tokensIn, state);
    const sellerSolBefore = await provider.connection.getBalance(buyer);

    await program.methods
      .sell(new BN(tokensIn.toString()), new BN((expected.net - 1n).toString()))
      .accounts({
        seller: buyer,
        globalConfig: configPda,
        bondingCurve,
        curveAuthority,
        mint: mint.publicKey,
        curveTokenAccount,
        sellerTokenAccount: buyerAta,
        feeRecipient,
        creator: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    applySell(tokensIn, state);

    const sellerSolAfter = await provider.connection.getBalance(buyer);
    // Seller is also the creator (payer) → receives net + creator fee, minus
    // the 5,000-lamport transaction fee paid by the payer.
    assert.equal(
      BigInt(sellerSolAfter - sellerSolBefore),
      expected.net + expected.creatorFee - 5_000n,
      "seller must receive net + creator fee minus the tx fee"
    );

    const balance = await getAccount(provider.connection, buyerAta);
    assert.equal(balance.amount, holdings - tokensIn);

    const curve = await program.account.bondingCurve.fetch(bondingCurve);
    assert.equal(curve.realTokenReserves.toString(), state.realToken.toString());
    assert.equal(curve.realSolReserves.toString(), state.realSol.toString());
  });

  it("graduates the curve when the SOL threshold is crossed", async () => {
    let graduationEvent: any = null;
    const listener = program.addEventListener("graduationEvent", (ev: any) => {
      graduationEvent = ev;
    });

    const buyAccounts = () => ({
      buyer,
      globalConfig: configPda,
      bondingCurve,
      curveAuthority,
      mint: mint.publicKey,
      curveTokenAccount,
      buyerTokenAccount: buyerAta,
      feeRecipient,
      creator: payer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });

    // 0.7 SOL → net ≈ 0.693 SOL (still below the 1.5 SOL threshold).
    const buy1 = BigInt(0.7 * LAMPORTS_PER_SOL);
    await program.methods.buy(new BN(buy1.toString()), new BN(0)).accounts(buyAccounts()).rpc();
    applyBuy(buy1, state);
    assert.equal((await program.account.bondingCurve.fetch(bondingCurve)).complete, false);

    // 0.9 SOL → net ≈ 0.891 SOL → total ≥ 1.5 SOL → graduated.
    const buy2 = BigInt(0.9 * LAMPORTS_PER_SOL);
    await program.methods.buy(new BN(buy2.toString()), new BN(0)).accounts(buyAccounts()).rpc();
    applyBuy(buy2, state);

    const curve = await program.account.bondingCurve.fetch(bondingCurve);
    assert.equal(curve.complete, true, "curve must auto-graduate past the threshold");
    assert.equal(curve.realSolReserves.toString(), state.realSol.toString());
    assert.ok(state.realSol >= GRADUATION_THRESHOLD);

    await new Promise((r) => setTimeout(r, 1500));
    program.removeEventListener(listener);
    if (graduationEvent) {
      assert.equal(graduationEvent.mint.toBase58(), mint.publicKey.toBase58());
    }
  });

  it("rejects selling after graduation", async () => {
    const holdings = (await getAccount(provider.connection, buyerAta)).amount;
    assert.ok(holdings > 0n);
    try {
      await program.methods
        .sell(new BN(holdings.toString()), new BN(0))
        .accounts({
          seller: buyer,
          globalConfig: configPda,
          bondingCurve,
          curveAuthority,
          mint: mint.publicKey,
          curveTokenAccount,
          sellerTokenAccount: buyerAta,
          feeRecipient,
          creator: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("sell after graduation must fail");
    } catch (err: any) {
      assert.ok(
        String(err).includes("CurveCompleted") || String(err).includes("migrated"),
        `unexpected error: ${String(err)}`
      );
    }
  });

  it("migrates a graduated curve: locks liquidity and burns mint authority", async () => {
    const [lockedLiquidity] = PublicKey.findProgramAddressSync(
      [Buffer.from("locked_liquidity"), mint.publicKey.toBytes()],
      program.programId
    );
    const lockedTokenAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      lockedLiquidity,
      true
    );

    const vaultBefore = (await getAccount(provider.connection, curveTokenAccount)).amount;
    const curveBefore = await program.account.bondingCurve.fetch(bondingCurve);

    await program.methods
      .migrate()
      .accounts({
        caller: payer.publicKey,
        globalConfig: configPda,
        bondingCurve,
        curveAuthority,
        mint: mint.publicKey,
        curveTokenAccount,
        lockedLiquidity,
        lockedTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Custody record: discriminator(8) + mint(32) + curve(32) + u64 + u64 + i64 + u8
    const lockInfo = await provider.connection.getAccountInfo(lockedLiquidity);
    assert.ok(lockInfo, "locked liquidity account exists");
    assert.equal(lockInfo.owner.toBase58(), program.programId.toBase58());
    assert.equal(lockInfo.data.length, 97);
    assert.equal(
      new PublicKey(lockInfo.data.slice(8, 40)).toBase58(),
      mint.publicKey.toBase58(),
      "lock record mint"
    );
    assert.equal(
      new PublicKey(lockInfo.data.slice(40, 72)).toBase58(),
      bondingCurve.toBase58(),
      "lock record curve"
    );
    assert.equal(
      Buffer.from(lockInfo.data).readBigUInt64LE(72),
      BigInt(curveBefore.realSolReserves.toString()),
      "locked SOL == curve reserves"
    );

    const lockedVault = await getAccount(provider.connection, lockedTokenAccount);
    assert.equal(lockedVault.amount, vaultBefore);

    const curveAfter = await program.account.bondingCurve.fetch(bondingCurve);
    assert.equal(curveAfter.realSolReserves.toString(), "0");
    assert.equal(curveAfter.realTokenReserves.toString(), "0");
    assert.equal(curveAfter.complete, true);

    // Mint & freeze authority burned — supply permanently fixed.
    const mintInfo = await getMint(provider.connection, mint.publicKey);
    assert.equal(mintInfo.mintAuthority, null);
    assert.equal(mintInfo.freezeAuthority, null);
  });

  it("refuses to graduate a fresh curve below the threshold (second grind)", async () => {
    console.log("  [grinder] mining a second ...Spw mint keypair...");
    const res = await grindVanityKeypair({ suffix: "Spw", threads: 4 });
    console.log(
      `  [grinder] ${res.publicKey} — ${res.attempts.toLocaleString()} attempts in ${(res.elapsedMs / 1000).toFixed(2)}s`
    );
    const mint2 = Keypair.fromSecretKey(res.secretKey);
    assert.ok(mint2.publicKey.toBase58().endsWith("Spw"));

    const [curve2] = PublicKey.findProgramAddressSync(
      [Buffer.from("curve"), mint2.publicKey.toBytes()],
      program.programId
    );
    const [auth2] = PublicKey.findProgramAddressSync(
      [Buffer.from("curve_authority"), mint2.publicKey.toBytes()],
      program.programId
    );
    const vault2 = getAssociatedTokenAddressSync(mint2.publicKey, auth2, true);
    const [md2] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), MPL_TOKEN_METADATA_PROGRAM_ID.toBytes(), mint2.publicKey.toBytes()],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );

    await program.methods
      .createCurve({
        name: "Second Spawn",
        symbol: "SPW2",
        uri: "https://ipfs.io/ipfs/FAKE2.json",
      })
      .accounts({
        payer: payer.publicKey,
        mint: mint2.publicKey,
        globalConfig: configPda,
        bondingCurve: curve2,
        curveAuthority: auth2,
        curveTokenAccount: vault2,
        metadata: md2,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mint2])
      .rpc();

    try {
      await program.methods
        .graduate()
        .accounts({
          caller: payer.publicKey,
          globalConfig: configPda,
          bondingCurve: curve2,
          mint: mint2.publicKey,
        })
        .rpc();
      assert.fail("graduating below threshold must fail");
    } catch (err: any) {
      assert.ok(
        String(err).includes("NotGraduated"),
        `unexpected error: ${String(err)}`
      );
    }
  });
});
