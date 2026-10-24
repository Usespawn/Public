// EVM/MetaMask artifact scan across the entire web app (source + deps).
const fs = require("fs");
const path = require("path");
const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/evm-scan.txt";
const ROOT = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web";
fs.writeFileSync(LOG, "");
const append = (s) => fs.appendFileSync(LOG, s + "\n");
const NEEDLES = [
  [/window\.ethereum|ethereum\.request/i, "window.ethereum"],
  [/metamask/i, "metamask"],
  [/ethers|ethersjs|wagmi|viem|web3\.js\b(?!\w)|walletconnect/i, "evm-lib"],
  [/evm|EVM/, "evm-word"],
  [/isMetaMask|MetaMaskFlare|window\.web3/, "metamask-detector"],
];
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.next|\.git|\.data|build-isolate/.test(p)) walk(p); continue; }
    if (!/\.(tsx|ts|js|mjs|cjs|jsx|json|css|html)$/.test(e.name)) continue;
    if (/package-lock\.json|tsconfig\.tsbuildinfo/.test(e.name)) continue;
    let src;
    try { src = fs.readFileSync(p, "utf8"); } catch { continue; }
    const rel = path.relative(ROOT, p);
    src.split("\n").forEach((line, i) => {
      for (const [re, label] of NEEDLES) {
        if (re.test(line)) append(`[${label}] ${rel}:${i + 1}: ${line.trim().slice(0, 170)}`);
      }
    });
  }
}
walk(ROOT);
append("EVM-SCAN-DONE");