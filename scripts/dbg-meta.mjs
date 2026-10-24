// Debug: File.slice sniffing + gateway lowercasing (pure ESM, no TS imports)
import { writeFileSync } from "fs";
const out = [];
(async () => {
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
  const f = new File(new Uint8Array(PNG), "a.png");
  out.push("f.size=" + f.size + " typeof slice=" + typeof f.slice);
  const head = new Uint8Array(await f.slice(0, 12).arrayBuffer());
  out.push("head: " + JSON.stringify(Array.from(head)));
  const sniff = (b) => {
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
    return null;
  };
  out.push("sniff(head): " + sniff(head));
  out.push("sniff(new Uint8Array(PNG)): " + sniff(new Uint8Array(PNG)));
  // gateway lowercasing
  process.env.PINATA_GATEWAY = "https://MyGateway.mypinata.cloud/";
  let host = (process.env.PINATA_GATEWAY ?? "ipfs.io").trim().replace(/\/+$/, "");
  host = host.replace(/^https?:\/\//i, "").replace(/\/ipfs(\/.*)?$/i, "").toLowerCase();
  out.push("host: " + host);
  writeFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/dbg-meta.txt", out.join("\n"));
  console.log("DBG-DONE");
})();