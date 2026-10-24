/**
 * POST /api/metadata/json — upload the token metadata document to IPFS.
 *
 * Input (JSON): { name, symbol, description?, imageUrl, website?, x?, telegram? }
 * - imageUrl must already be a public https IPFS URL (produced by the image
 *   upload route) — the server never fetches client-supplied URLs.
 * - The document references the uploaded image and is stored on the PUBLIC
 *   IPFS network; the response carries cid + resolvable https URL, which the
 *   client then passes to the pump.fun create_v2 instruction as `uri`.
 */
import { NextResponse } from "next/server";
import { pinataUploadJson } from "@/lib/metadata/pinata";
import { buildTokenMetadata, validateTokenMetadataInput } from "@/lib/metadata/upload";

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 20;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate limit exceeded" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const validationError = validateTokenMetadataInput(body);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const metadata = buildTokenMetadata({
    name: (body.name as string).trim(),
    symbol: (body.symbol as string).trim(),
    description: typeof body.description === "string" ? body.description : "",
    imageUrl: body.imageUrl as string,
    website: typeof body.website === "string" && body.website ? body.website : undefined,
    x: typeof body.x === "string" && body.x ? body.x : undefined,
    telegram: typeof body.telegram === "string" && body.telegram ? body.telegram : undefined,
  });

  try {
    const safeName = `${metadata.symbol}-${metadata.name}`.slice(0, 40).replace(/[^\w.-]+/g, "_");
    const result = await pinataUploadJson(`${safeName}.json`, metadata);
    return NextResponse.json({ ok: true, cid: result.cid, url: result.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "metadata upload failed";
    const status = msg.startsWith("IPFS upload not configured") ? 503 : 502;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}