/**
 * Launch cost measurement — READ-ONLY (no signing, no simulation broadcast).
 * - Exact base/priority fee for the real create_v2 message via getFeeForMessage
 *   (Message compilation needs NO signatures; a throwaway vanity keypair is
 *   generated locally and never used beyond its public key).
 * - Account rents via getMinimumBalanceForRentExemption for the account sizes
 *   the launch creates (documented sources for each size).
 */
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { buildCreateTransaction } from "./lib/launch/launch";
import { getRpcUrl, getNetwork, isSpawnVanityAddress } from "./lib/config";
import fs from "node:fs";

// tsx does not load .env.local (only Next.js does) — load the two public
// network vars manually so this runs against the CONFIGURED cluster.
const envSrc = fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/web/.env.local", "utf8");
for (const line of envSrc.split(/\r?\n/)) {
  const m = line.match(/^(NEXT_PUBLIC_NETWORK|NEXT_PUBLIC_SOLANA_RPC)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const LOG = "C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/fee-check.txt";
fs.writeFileSync(LOG, "");
const append = (s: string) => fs.appendFileSync(LOG, s + "\n");
const sol = (lamports: number | bigint) => (Number(lamports) / LAMPORTS_PER_SOL).toFixed(9) + " SOL";

async function main() {
  const connection = new Connection(getRpcUrl(), "confirmed");
  append(`network: ${getNetwork()} (read-only RPC)`);

  // Reuse the previously ground vanity keypair (public address verified;
  // the secret is loaded from the sanitized handoff file, never printed).
  const handoff = JSON.parse(
    fs.readFileSync("C:/Users/ramad/.cline/data/workspaces/chat/spawnpad/ground-handoff.json", "utf8")
  );
  const mintKp = Keypair.fromSecretKey(new Uint8Array(handoff.secretKey));
  if (!isSpawnVanityAddress(mintKp.publicKey.toBase58()) || mintKp.publicKey.toBase58() !== handoff.address) {
    throw new Error("ground handoff keypair inconsistent — refusing to proceed");
  }
  append(`ground vanity mint (public address): ${mintKp.publicKey.toBase58()} — keypair never signed with, never used on-chain`);

  const payer = Keypair.generate().publicKey; // dummy payer address (no wallet, no keys used)
  const { blockhash } = await connection.getLatestBlockhash("finalized");

  const tx = await buildCreateTransaction(
    { name: "FeeProbe", symbol: "FEEPROBE", uri: "https://example.com/ipfs/feeprobe", payer, mintKeypair: mintKp },
    { recentBlockhash: blockhash }
  );
  const msg = tx.compileMessage();
  append(`required signatures in message: ${msg.header.numRequiredSignatures}`);
  const fee = await connection.getFeeForMessage(msg, "finalized");
  const feeVal = fee.value ?? 0;
  append(`getFeeForMessage: ${feeVal} lamports = ${sol(feeVal)} (base fee x signatures)`);

  // Priority fee from the actual construction (launch.ts):
  // setComputeUnitLimit 400_000 units, setComputeUnitPrice 1000 microLamports/CU.
  const maxPriorityLamports = 400_000 * 1_000 / 1_000_000; // 400 lamports
  append(`priority fee cap (from code): ${maxPriorityLamports} lamports = ${sol(maxPriorityLamports)} (1000 microLamports/CU x <=400000 CU)`);

  // Rents for accounts the create_v2 transaction creates.
  const sizes: Array<[string, number, string]> = [
    ["SPL mint (base, 82 bytes)", 82, "classic mint size; Token-2022 mint with metadata-pointer/metadata extensions is larger"],
    ["SPL token account (165 bytes)", 165, "ATA of the bonding curve (associatedBondingCurve)"],
    ["Metaplex Token Metadata (679 bytes)", 679, "standard metadata account size (mpl_token_metadata)"],
    ["BondingCurve (minimum 49 bytes)", 49, "lower bound from the vendored layout: 8B discriminator + u64 fields + complete flag @48"],
  ];
  let rents = 0;
  for (const [label, size, source] of sizes) {
    const r = await connection.getMinimumBalanceForRentExemption(size);
    rents += r;
    append(`rent ${label}: ${r} lamports = ${sol(r)}  [${source}]`);
  }
  append(`rent subtotal (known sizes): ${rents} lamports = ${sol(rents)}`);
  append(`NOTE: exact Token-2022 mint extension size and current bonding-curve size are program-determined;`);
  append(`      rents above are computed for documented minimum sizes (bonding-curve rent is a lower bound).`);
  append(`total launch cost (this tx, no initial buy): ${feeVal + rents} lamports ≈ ${sol(feeVal + rents)} + any priority fee consumed`);
  append("FEE-CHECK-DONE");
}
main().catch((e) => { fs.appendFileSync(LOG, "FEE-CHECK-FAILED: " + String(e?.message || e) + "\n"); });