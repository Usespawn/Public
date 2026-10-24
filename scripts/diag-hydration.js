/** Diagnose: EVM references in app code + <i> producers + wallet-adapter internals. */
const fs = require("fs");
const path = require("path");
const out = [];

function walk(dir, filter, skipNode) {
  let files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipNode && ["node_modules", ".next", ".git"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p, filter, skipNode));
    else if (!filter || /\.(ts|tsx|js|jsx|json)$/.test(e.name)) files.push(p);
  }
  return files;
}

const WEB = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";

// 1. App code: any EVM/MetaMask references?
out.push("=== APP CODE: MetaMask/ethereum/EVM refs ===");
const evmRe = /metamask|window\.ethereum|ethereum\.request|eth_requestAccounts|web3\.js|ethers/i;
for (const f of walk(WEB + "/app", null, true).concat(walk(WEB + "/components", null, true), walk(WEB + "/lib", null, true))) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((l, i) => {
    if (evmRe.test(l)) out.push(`${f.replace(WEB, "")}:${i + 1}: ${l.trim().slice(0, 100)}`);
  });
}
out.push("(end of EVM scan)");

// 2. App code: literal <i> elements
out.push("=== APP CODE: literal <i> elements ===");
for (const f of walk(WEB + "/app", null, true).concat(walk(WEB + "/components", null, true))) {
  const src = fs.readFileSync(f, "utf8");
  if (/<i[\s>]/.test(src)) out.push(f.replace(WEB, "") + " HAS <i>");
}
out.push("(end of <i> scan)");

// 3. wallet-adapter-react-ui internals: does the button render <i>?
out.push("=== wallet-adapter-react-ui internals ===");
const uiDir = WEB + "/node_modules/@solana/wallet-adapter-react-ui/lib/esm";
for (const f of walk(uiDir, null, false)) {
  const src = fs.readFileSync(f, "utf8");
  if (/<i[\s>]/.test(src)) {
    out.push("--- " + path.basename(f) + " contains <i>:");
    src.split("\n").forEach((l, i) => {
      if (/<i[\s>]/.test(l)) out.push(`  ${i + 1}: ${l.trim().slice(0, 140)}`);
    });
  }
}

fs.writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/diag.log", out.join("\n"));
console.log("DIAG-DONE");
