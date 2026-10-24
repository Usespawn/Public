// Launch cost measurement v2 — plain node, NO SDK, NO signing.
// - getFeeForMessage on a 2-signature message (mint + user signers, per the
//   create_v2 IDL) — verifies the per-signature base fee.
// - getMinimumBalanceForRentExemption for the account sizes create_v2 creates.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/fee-check2.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const sol = (l) => (Number(l) / 1e9).toFixed(9) + " SOL";

const web3 = require("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/@solana/web3.js");
const { Connection, Keypair, Transaction, TransactionInstruction, SystemProgram } = web3;

// Configured network (from .env.local).
const envSrc = fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/.env.local", "utf8");
let rpc = null, network = null;
for (const line of envSrc.split(/\r?\n/)) {
  let m = line.match(/^NEXT_PUBLIC_SOLANA_RPC=(.*)$/);
  if (m && m[1].trim()) rpc = m[1].trim();
  m = line.match(/^NEXT_PUBLIC_NETWORK=(.*)$/);
  if (m) network = m[1].trim();
}
const net = network === "mainnet" || network === "mainnet-beta" ? "mainnet-beta" : network;
if (!rpc) rpc = `https://api.${net}.solana.com`;
const masked = rpc.replace(/\/v2\/.*$/, "/v2/<redacted>").replace(/\?.*$/, "?<redacted>");
append(`network: ${net}`);
append(`rpc (masked): ${masked}`);

const connection = new Connection(rpc, "confirmed");
const payer = Keypair.generate().publicKey; // dummy addresses — no wallet, no keys
const mint = Keypair.generate().publicKey;

(async () => {
  // Cluster identity check (genesis) — must match the configured network.
  const genesis = await connection.getGenesisHash();
  append(`getGenesisHash: ${genesis} (${genesis.startsWith("5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp") ? "mainnet-beta OK" : "NOT MAINNET — STOP"})`);

  // 2-signature message (mint + user), same signer count as create_v2.
  const tx = new Transaction({ feePayer: payer }).add(
    new TransactionInstruction({
      programId: SystemProgram.programId,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: true, isWritable: false },
      ],
      data: Buffer.from([0]),
    })
  );
  tx.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
  const fee = await connection.getFeeForMessage(tx.compileMessage(), "finalized");
  append(`getFeeForMessage (2 signers): ${fee.value} lamports = ${sol(fee.value)}`);
  append(`  = 2 x 5000 lamports base fee (create_v2 IDL: signers = mint + user; user = fee payer)`);

  const priorityLamports = 400_000 * 1000 / 1_000_000;
  append(`priority fee cap (launch.ts: 1000 microLamports/CU x <=400000 CU): ${priorityLamports} lamports = ${sol(priorityLamports)}`);

  // Rents for the accounts create_v2 creates (paid by the fee payer).
  const sizes = [
    ["mint base (82B)", 82, "Token-2022 mint + metadata-pointer/metadata extensions is larger (program-determined)"],
    ["mint with metadata ext (est. 230B)", 230, "estimate for a typical name/symbol/uri length — exact size is program-side"],
    ["associated_bonding_curve ATA (165B)", 165, "standard Token-2022 ATA minimum"],
    ["bonding_curve lower bound (49B)", 49, "vendored layout minimum; actual curve is larger"],
    ["mayhem PDAs (est. 100B each)", 100, "mayhem_state + mayhem_token_vault created by create_v2 (mayhem_mode=false)"],
  ];
  for (const [label, size, note] of sizes) {
    const r = await connection.getMinimumBalanceForRentExemption(size);
    append(`rent ${label}: ${r} lamports = ${sol(r)}  [${note}]`);
  }
  append("FEE-CHECK2-DONE");
})().catch((e) => { append("FEE-CHECK2-FAILED: " + String(e?.message || e).slice(0, 200)); });