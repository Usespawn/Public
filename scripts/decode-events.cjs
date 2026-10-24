// Decodes Anchor TradeEvent base64 blobs found in the validator log.
const fs = require("fs");
const log = fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/.ledger/validator.log", "utf8");
const out = [];
const re = /"Program data: ([A-Za-z0-9+/=]+)"/g;
let m;
while ((m = re.exec(log))) {
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 121) continue;
  // TradeEvent discriminator: sha256("event:TradeEvent")[0..8]
  const d = buf.slice(0, 8).toString("hex");
  const mint = buf.slice(8, 40).toString("hex");
  const user = buf.slice(40, 72).toString("hex");
  const isBuy = buf[72];
  const u64 = (o) => Number(buf.readBigUInt64LE(o));
  const i64 = (o) => Number(buf.readBigInt64LE(o));
  try {
    out.push(
      `disc=${d} isBuy=${isBuy} sol=${u64(73)} tokens=${u64(81)} protoFee=${u64(89)} creatorFee=${u64(97)} virtSol=${u64(105)} virtToken=${u64(113)} ts=${i64(121)} len=${buf.length}`
    );
  } catch (e) {
    out.push("decode err len=" + buf.length);
  }
}
fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/events.txt", out.join("\n") || "no events");
