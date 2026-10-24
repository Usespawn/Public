// Dump the pump IDL BondingCurve account field order (name/type), in order.
const fs = require("fs");
const p = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/@pump-fun/pump-sdk/src/idl/pump.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const out = [];
out.push("program address: " + j.address);
const bc = j.accounts.find((a) => a.name === "BondingCurve");
out.push("program address: " + j.address);
out.push("BondingCurve keys: " + Object.keys(bc).join(", "));
if (bc.discriminator) out.push("discriminator: " + JSON.stringify(bc.discriminator));
const t = bc.type || (j.types || []).find((ty) => ty.name === "BondingCurve");
out.push("type kind: " + (t && t.type && t.type.kind));
(t.type.fields || t.fields || []).forEach((f, i) =>
  out.push(i + ": " + f.name + " : " + JSON.stringify(f.type))
);
fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/idl-bc-fields.txt", out.join("\n"));
console.log("DUMP-DONE");
fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/idl-bc-fields.txt", out.join("\n"));
console.log("DUMP-DONE");