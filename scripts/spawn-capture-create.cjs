/**
 * READ-ONLY — capture the FULL parsed create transaction as a test fixture.
 */
const fs = require("fs");
const path = require("path");
const ROOT = "c:/Users/ramad/.cline/data/workspaces/chat/spawnpad";
const SIG = "573GqJL6Y7GrMhM4No7xD73w4CzSLFmXASexD56cBWakAfxyD1Qb4rqEjK5fKdjWyeWgxvMN2aTnrsgJhikeHbFY";
const { Connection, PublicKey } = require(path.join(ROOT, "node_modules/@solana/web3.js"));
const envTxt = fs.readFileSync(path.join(ROOT, "web/.env.local"), "utf8");
const rpcUrl = envTxt.match(/NEXT_PUBLIC_SOLANA_RPC=(\S+)/)[1].trim();
const conn = new Connection(rpcUrl, "confirmed");

(async () => {
  const tx = await conn.getParsedTransaction(SIG, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
  if (!tx) { console.log("TX NOT FOUND"); return; }
  const msg = tx.transaction.message;
  const fixture = {
    meta: { err: tx.meta?.err ?? null },
    transaction: {
      message: {
        accountKeys: (msg.accountKeys ?? []).map((k) => ({
          pubkey: typeof k === "string" ? k : k.pubkey,
          signer: k.signer === true,
          writable: k.writable === true,
        })),
        instructions: (msg.instructions ?? []).map((ix) => ({
          programId: typeof ix.programId === "string" ? ix.programId : String(ix.programId),
          data: typeof ix.data === "string" ? ix.data : Array.from(ix.data ?? []),
          accounts: (ix.accounts ?? []).map((a) => (typeof a === "string" ? a : String(a?.pubkey ?? a))),
        })),
      },
    },
  };
  fs.mkdirSync(path.join(ROOT, "tests", "web", "fixtures"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "tests", "web", "fixtures", "create-tx-mainnet.json"),
    JSON.stringify(fixture, null, 2));
  console.log("FIXTURE-DONE instructions=" + fixture.transaction.message.instructions.length);
})().catch((e) => console.log("FIXTURE-FAIL " + e.message));