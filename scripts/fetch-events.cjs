// Fetches recent txs involving the spawnpad program and decodes TradeEvents.
const { Connection, PublicKey } = require(require("path").join(__dirname, "..", "node_modules", "@solana", "web3.js"));
const PROGRAM = new PublicKey("3CNhTgbuB68YC5C2vGTCJL6LpHvTokdsLQ1Xkv37s3mg");
const conn = new Connection("http://127.0.0.1:8899", "confirmed");
(async () => {
  const out = [];
  const sigs = await conn.getSignaturesForAddress(PROGRAM, { limit: 12 });
  for (const s of sigs) {
    if (!s.err) {
      const tx = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
      if (!tx) continue;
      const logs = (tx.meta && tx.meta.logMessages) || [];
      for (const l of logs) {
        const m = l.match(/Program data: ([A-Za-z0-9+/=]+)/);
        if (m) {
          const buf = Buffer.from(m[1], "base64");
          if (buf.length >= 129) {
            const isBuy = buf[72];
            out.push(
              `tx=${s.signature.slice(0, 10)} isBuy=${isBuy} sol=${buf.readBigUInt64LE(73)} tokens=${buf.readBigUInt64LE(81)} protoFee=${buf.readBigUInt64LE(89)} creatorFee=${buf.readBigUInt64LE(97)} virtSol=${buf.readBigUInt64LE(105)} virtToken=${buf.readBigUInt64LE(113)}`
            );
          }
        }
      }
    }
  }
  require("fs").writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/events.txt", out.join("\n") || "no events found");
  process.exit(0);
})().catch((e) => {
  require("fs").writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/events.txt", "ERR " + e.message);
  process.exit(1);
});
