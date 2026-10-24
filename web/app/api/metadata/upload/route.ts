/**
 * POST /api/metadata/upload — image upload to IPFS (public network).
 *
 * Server-side validation is mandatory: extension, size AND magic bytes
 * (a renamed .exe with a PNG extension is rejected). Credentials live
 * server-only (PINATA_JWT); the browser only ever receives cid + public URL.
 *
 * Reuses the fixed-window rate limiter pattern from /api/launches.
 */
import { NextResponse } from "next/server";
import { pinataUploadFile } from "@/lib/metadata/pinata";
import { sniffImageType, fileExtension, MAX_IMAGE_BYTES } from "@/lib/metadata/upload";

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 10;
}

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate limit exceeded" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing file" }, { status: 400 });
  }

  const ext = fileExtension(file.name);
  if (!(ext in EXT_TO_MIME)) {
    return NextResponse.json({ ok: false, error: "unsupported format — use PNG, JPEG or WebP" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ ok: false, error: "file is empty" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { ok: false, error: `image too large — max ${(MAX_IMAGE_BYTES / (1024 * 1024)).toFixed(0)} MB` },
      { status: 400 }
    );
  }

  // Magic-byte sniffing — the declared MIME/extension is never trusted.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (!sniffed) {
    return NextResponse.json(
      { ok: false, error: "file content is not a valid PNG, JPEG or WebP image" },
      { status: 400 }
    );
  }

  try {
    const result = await pinataUploadFile({
      name: file.name,
      contentType: EXT_TO_MIME[ext],
      bytes,
    });
    return NextResponse.json({ ok: true, cid: result.cid, url: result.url, bytes: result.size });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "IPFS upload failed";
    const status = msg.startsWith("IPFS upload not configured") ? 503 : 502;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}