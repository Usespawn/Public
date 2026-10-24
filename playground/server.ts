// Spawnpad local playground server — serves the UI and proxies on-chain
// actions against the native Windows localnet validator.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";
import { generateSpawnKeypair } from "@spawnpad/vanity-grinder";

const ROOT = "C:\\Users\\ramad\\.cline\\data\\workspaces\\chat\\spawnpad";
const RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("3CNhTgbuB68YC5C2vGTCJL6LpHvTokdsLQ1Xkv37s3mg");
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
const LAUNCHES_FILE = path.join(ROOT, "playground", "launches.json");

const connection = new Connection(RPC, "confirmed");
const payerFile = path.join(ROOT, "keypairs", "localnet-wallet.json");
const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(payerFile, "utf8")))
);
const provider = new AnchorProvider(connection, new Wallet(payer), {});
const idl = JSON.parse(
  fs.readFileSync(path.join(ROOT, "target", "idl", "spawnpad_engine.json"), "utf8")
);
const program = new Program(idl, provider);

// Fee recipient is fixed per playground instance.
const feeRecipientFile = path.join(ROOT, "playground", "fee-recipient.json");
let feeRecipient: Keypair;
if (fs.existsSync(feeRecipientFile)) {
  feeRecipient = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(feeRecipientFile, "utf8")))
  );
} else {
  feeRecipient = Keypair.generate();
  fs.writeFileSync(feeRecipientFile, JSON.stringify(Array.from(feeRecipient.secretKey)));
}

// Test-tuned config so graduation is reachable in a demo.
const TOTAL_FEE_BPS = 100;
const CREATOR_FEE_BPS = 2000;
const GRADUATION_THRESHOLD = BigInt(1.5 * LAMPORTS_PER_SOL);
const INITIAL_VIRTUAL_SOL = 30_000_000_000n;
const INITIAL_VIRTUAL_TOKEN = 1_073_000_000_000_000n;
const CURVE_TOKEN_RESERVES = 793_100_000_000_000n;

const CONFIG_SEED = Buffer.from("global_config");
const CURVE_SEED = Buffer.from("curve");
const AUTHORITY_SEED = Buffer.from("curve_authority");
const LOCK_SEED = Buffer.from("locked_liquidity");

function pdas(mint: PublicKey) {
  const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [CURVE_SEED, mint.toBytes()],
    PROGRAM_ID
  );
  const [curveAuthority] = PublicKey.findProgramAddressSync(
    [AUTHORITY_SEED, mint.toBytes()],
    PROGRAM_ID
  );
  const curveTokenAccount = getAssociatedTokenAddressSync(mint, curveAuthority, true);
  const [metadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_TOKEN_METADATA_PROGRAM_ID.toBytes(), mint.toBytes()],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
  const [lockedLiquidity] = PublicKey.findProgramAddressSync(
    [LOCK_SEED, mint.toBytes()],
    PROGRAM_ID
  );
  const lockedTokenAccount = getAssociatedTokenAddressSync(mint, lockedLiquidity, true);
  const buyerAta = getAssociatedTokenAddressSync(mint, payer.publicKey, true);
  return {
    configPda,
    bondingCurve,
    curveAuthority,
    curveTokenAccount,
    metadata,
    lockedLiquidity,
    lockedTokenAccount,
    buyerAta,
  };
}

function loadLaunches(): any[] {
  try {
    return JSON.parse(fs.readFileSync(LAUNCHES_FILE, "utf8"));
  } catch {
    return [];
  }
}
function saveLaunches(list: any[]) {
  fs.writeFileSync(LAUNCHES_FILE, JSON.stringify(list, null, 2));
}

const json = (res: http.ServerResponse, code: number, data: any) => {
  if (res.headersSent) {
    try {
      res.end(JSON.stringify(data));
    } catch {
      /* socket gone */
    }
    return;
  }
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

process.on("unhandledRejection", (e) => {
  console.error("UNHANDLED-REJECTION", String(e));
});
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT-EXCEPTION", String(e));
});

async function readBody(req: http.IncomingMessage): Promise<any> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function ensureConfig(): Promise<void> {
  const { configPda } = pdas(Keypair.generate().publicKey);
  try {
    await program.account.globalConfig.fetch(configPda);
    return; // already initialized
  } catch {
    /* not yet */
  }
  await program.methods
    .initialize({
      feeRecipient: feeRecipient.publicKey,
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
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";
  try {
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fs.readFileSync(path.join(ROOT, "playground", "index.html")));
      return;
    }
    if (req.method === "GET" && url === "/api/balance") {
      const bal = await connection.getBalance(payer.publicKey);
      json(res, 200, { ok: true, balance: bal, wallet: payer.publicKey.toBase58() });
      return;
    }
    if (req.method === "POST" && url === "/api/init") {
      await ensureConfig();
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url === "/api/grind") {
      const t0 = Date.now();
      const ground = await generateSpawnKeypair({ threads: 4, maxAttempts: 10_000_000 });
      json(res, 200, {
        ok: true,
        publicKey: ground.publicKey,
        secretKey: bs58.encode(ground.secretKey),
        attempts: ground.attempts,
        elapsedMs: Date.now() - t0,
      });
      return;
    }
    if (req.method === "POST" && url === "/api/create") {
      const body = await readBody(req);
      const mint = Keypair.fromSecretKey(new Uint8Array(bs58.decode(body.secretKey)));
      await ensureConfig();
      const p = pdas(mint.publicKey);
      const name = body.name || "Spawn Token";
      const symbol = body.symbol || "SPWN";
      const uri = body.uri || "https://ipfs.io/ipfs/FAKE_METADATA_URI.json";
      await program.methods
        .createCurve({ name, symbol, uri })
        .accounts({
          payer: payer.publicKey,
          mint: mint.publicKey,
          globalConfig: p.configPda,
          bondingCurve: p.bondingCurve,
          curveAuthority: p.curveAuthority,
          curveTokenAccount: p.curveTokenAccount,
          metadata: p.metadata,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();
      const launches = loadLaunches().filter(
        (l) => l.mint !== mint.publicKey.toBase58()
      );
      launches.unshift({
        mint: mint.publicKey.toBase58(),
        secretKey: bs58.encode(mint.secretKey),
        name,
        symbol,
        launchedAt: Date.now(),
      });
      saveLaunches(launches);
      json(res, 200, { ok: true, mint: mint.publicKey.toBase58() });
      return;
    }
    const handled = await handleMore(req, res);
    if (!handled) json(res, 404, { ok: false, error: "not found" });
  } catch (err: any) {
    json(res, 500, { ok: false, error: String(err?.message || err) });
  }
});

// Trailing route group: buy/sell/migrate/state/mints.

async function handleMore(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = req.url || "/";
  try {
    if (req.method === "POST" && url === "/api/buy") {
      const body = await readBody(req);
      const mint = new PublicKey(body.mint);
      const p = pdas(mint);
      const gross = BigInt(Math.round(Number(body.sol) * 1e9));
      await program.methods
        .buy(new BN(gross.toString()), new BN(0))
        .accounts({
          buyer: payer.publicKey,
          globalConfig: p.configPda,
          bondingCurve: p.bondingCurve,
          curveAuthority: p.curveAuthority,
          mint,
          curveTokenAccount: p.curveTokenAccount,
          buyerTokenAccount: p.buyerAta,
          feeRecipient: feeRecipient.publicKey,
          creator: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      json(res, 200, { ok: true });
      return true;
    }
    if (req.method === "POST" && url === "/api/sell") {
      const body = await readBody(req);
      const mint = new PublicKey(body.mint);
      const p = pdas(mint);
      const holdings = BigInt((await getAccount(connection, p.buyerAta)).amount);
      const tokensIn = (holdings * BigInt(body.pct)) / 100n;
      await program.methods
        .sell(new BN(tokensIn.toString()), new BN(0))
        .accounts({
          seller: payer.publicKey,
          globalConfig: p.configPda,
          bondingCurve: p.bondingCurve,
          curveAuthority: p.curveAuthority,
          mint,
          curveTokenAccount: p.curveTokenAccount,
          sellerTokenAccount: p.buyerAta,
          feeRecipient: feeRecipient.publicKey,
          creator: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      json(res, 200, { ok: true });
      return true;
    }
    if (req.method === "POST" && url === "/api/migrate") {
      const body = await readBody(req);
      const mint = new PublicKey(body.mint);
      const p = pdas(mint);
      await program.methods
        .migrate()
        .accounts({
          caller: payer.publicKey,
          globalConfig: p.configPda,
          bondingCurve: p.bondingCurve,
          curveAuthority: p.curveAuthority,
          mint,
          curveTokenAccount: p.curveTokenAccount,
          lockedLiquidity: p.lockedLiquidity,
          lockedTokenAccount: p.lockedTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      json(res, 200, { ok: true });
      return true;
    }
    if (req.method === "GET" && url.startsWith("/api/curve/")) {
      const mint = new PublicKey(url.slice("/api/curve/".length));
      const p = pdas(mint);
      const curve = await program.account.bondingCurve.fetch(p.bondingCurve);
      const vault = await getAccount(connection, p.curveTokenAccount);
      let holdings: bigint = 0n;
      try {
        holdings = await getAccount(connection, p.buyerAta).then((a) => a.amount);
      } catch {
        holdings = 0n;
      }
      json(res, 200, {
        ok: true,
        virtualSolReserves: curve.virtualSolReserves.toString(),
        virtualTokenReserves: curve.virtualTokenReserves.toString(),
        realSolReserves: curve.realSolReserves.toString(),
        realTokenReserves: curve.realTokenReserves.toString(),
        complete: curve.complete,
        creator: curve.creator.toBase58(),
        vaultTokens: vault.amount.toString(),
        myTokens: holdings.toString(),
      });
      return true;
    }
    if (req.method === "GET" && url === "/api/mints") {
      json(res, 200, { ok: true, launches: loadLaunches() });
      return true;
    }
    return false;
  } catch (err: any) {
    json(res, 500, { ok: false, error: String(err?.message || err) });
    return true;
  }
}

function tryListen(port: number): Promise<number> {
  return new Promise((resolve) => {
    const onListening = () => {
      cleanup();
      resolve(port);
    };
    const onError = () => {
      cleanup();
      resolve(0);
    };
    function cleanup() {
      server.removeListener("listening", onListening);
      server.removeListener("error", onError);
    }
    server.once("listening", onListening);
    server.once("error", onError);
    server.listen(port, "127.0.0.1");
  });
}

(async () => {
  let port = 0;
  for (const p of [3000, 3001, 3002]) {
    port = await tryListen(p);
    if (port) break;
  }
  if (!port) {
    console.error("SERVER-ERROR: all ports busy");
    process.exit(1);
  }
  console.log(`[spawnpad playground] listening at http://localhost:${port}`);
  console.log(`[spawnpad playground] wallet=${payer.publicKey.toBase58()}`);
  console.log(`[spawnpad playground] rpc=${RPC}`);
  console.log("PLAYGROUND-READY");
})();
