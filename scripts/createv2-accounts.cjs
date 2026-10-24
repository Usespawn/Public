// Extract create_v2 account list (names + writable/signer flags) from pump.json.
const fs = require("fs");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/createv2-accounts.txt";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");

const idl = JSON.parse(
  fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/node_modules/@pump-fun/pump-sdk/src/idl/pump.json", "utf8")
);
append("top-level keys: " + Object.keys(idl).join(", "));
const arr = idl.instructions || [];
append("instructions count: " + arr.length);
const ixn = arr.find((i) => /create_v2/i.test(i.name || ""));
if (!ixn) {
  append("names containing 'create': " + arr.filter((i) => /create/i.test(i.name)).map((i) => i.name).join(", "));
  append("CREATEV2-ACCOUNTS-DONE (not found)");
} else {
  append(`instruction: ${ixn.name}`);
  for (const a of ixn.accounts) {
    const pda = a.pda ? `pda(${(a.pda.seeds || []).map((s) => s.kind + (s.path ? ":" + s.path : "")).join(",")})` : "";
    append(`  ${a.name.padEnd(30)} writable=${!!a.writable} signer=${!!a.signer} ${pda}`);
  }
  append(`total accounts: ${ixn.accounts.length}`);
  append(`signers: ${ixn.accounts.filter((a) => a.signer).map((a) => a.name).join(", ")} (+ tx fee payer)`);
}
append("CREATEV2-ACCOUNTS-DONE");