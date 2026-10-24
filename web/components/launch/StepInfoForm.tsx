"use client";

/**
 * Step 1: token information form — includes the token image upload.
 * Nothing is uploaded until the user presses "Upload to IPFS". Selecting a
 * different file clears any previous upload, so the user can replace the
 * image before launch (the new file must be re-uploaded explicitly).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImageUp, Loader2, X } from "lucide-react";
import { Field } from "./ui";
import { validateImageFile } from "@/lib/metadata/upload";
import { uploadImageToIpfs } from "@/lib/metadata/upload-client";

export interface TokenInfo {
  name: string;
  symbol: string;
  description: string;
  website: string;
  x: string;
  telegram: string;
  /** Set after a successful image upload (server-verified). */
  imageCid: string | null;
  imageUrl: string | null;
}

/** Shared validity rule for the token info section (name, symbol, image). */
export function isInfoValid(info: TokenInfo): boolean {
  return (
    info.name.trim().length >= 2 && info.name.length <= 64 &&
    info.symbol.trim().length >= 2 && info.symbol.length <= 10 &&
    Boolean(info.imageCid && info.imageUrl)
  );
}

export function StepInfoForm({
  info,
  setInfo,
  connected,
}: {
  info: TokenInfo;
  setInfo: (patch: Partial<TokenInfo>) => void;
  connected: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Object-URL lifecycle: revoke the previous preview whenever it changes.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const pickFile = useCallback(
    async (f: File | null) => {
      setFile(f);
      setUploadError(null);
      setProgress(null);
      // A new (or cleared) selection invalidates any previous upload.
      if (info.imageCid || info.imageUrl) setInfo({ imageCid: null, imageUrl: null });
      if (!f) {
        setPreviewUrl(null);
        setClientError(null);
        return;
      }
      const err = await validateImageFile(f);
      if (err) {
        setClientError(err);
        setPreviewUrl(null);
        return;
      }
      setClientError(null);
      setPreviewUrl(URL.createObjectURL(f));
    },
    [info.imageCid, info.imageUrl, setInfo]
  );

  const startUpload = useCallback(async () => {
    if (!file) return;
    const err = await validateImageFile(file);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError(null);
    setProgress(0);
    try {
      const res = await uploadImageToIpfs(file, (pct) => setProgress(pct));
      setProgress(100);
      setInfo({ imageCid: res.cid, imageUrl: res.url });
    } catch (e: unknown) {
      setProgress(null);
      setUploadError(e instanceof Error ? e.message : "image upload failed");
    }
  }, [file, setInfo]);

  const imageReady = Boolean(info.imageCid && info.imageUrl);

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <h2 className="font-display text-lg font-bold">01 · Token information</h2>
      <Field label="Token name">
        <input className="input" value={info.name} onChange={(e) => setInfo({ name: e.target.value })} placeholder="SpawnCoin" maxLength={64} />
      </Field>
      <Field label="Symbol / ticker">
        <input className="input font-mono" value={info.symbol} onChange={(e) => setInfo({ symbol: e.target.value.toUpperCase() })} placeholder="SPWN" maxLength={10} />
      </Field>
      <Field label="Description">
        <textarea className="input min-h-20" value={info.description} onChange={(e) => setInfo({ description: e.target.value })} placeholder="What is this token about?" maxLength={500} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Website"><input className="input" value={info.website} onChange={(e) => setInfo({ website: e.target.value })} placeholder="https://…" /></Field>
        <Field label="X / Twitter"><input className="input" value={info.x} onChange={(e) => setInfo({ x: e.target.value })} placeholder="@handle" /></Field>
        <Field label="Telegram"><input className="input" value={info.telegram} onChange={(e) => setInfo({ telegram: e.target.value })} placeholder="@group" /></Field>
      </div>

      {/* Image upload — explicit user action, nothing uploads automatically. */}
      <Field label="Token image (PNG · JPEG · WebP — max 5 MB)">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 font-mono text-[12.5px] text-ink transition-colors hover:border-acid/50 hover:text-acid"
          >
            <ImageUp className="size-4" />
            {file ? (file.name.length > 28 ? `${file.name.slice(0, 25)}…` : file.name) : "Choose image"}
          </button>

          {file && !imageReady && (
            <button
              type="button"
              onClick={startUpload}
              disabled={progress !== null}
              className="inline-flex items-center gap-2 rounded-full bg-acid/15 px-4 py-2 font-mono text-[12.5px] font-bold text-acid transition-colors hover:bg-acid/25 disabled:opacity-50"
            >
              {progress !== null ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
              Upload to IPFS
            </button>
          )}

          {imageReady && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/15 px-3 py-1 font-mono text-[11px] text-ok">
              <Check className="size-3.5" /> uploaded · {info.imageCid?.slice(0, 10)}…
            </span>
          )}
        </div>

        {previewUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={previewUrl} alt="Token image preview" className="mt-2 size-24 rounded-xl border border-line object-cover" />
        )}
        {progress !== null && progress < 100 && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-raised">
            <div className="h-full bg-acid transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {(clientError || uploadError) && (
          <p className="mt-1 text-[12.5px] text-crimson">{clientError || uploadError}</p>
        )}
        {imageReady && (
          <p className="mt-1 font-mono text-[11px] text-faint">image pinned publicly · {info.imageUrl}</p>
        )}
      </Field>
    </div>
  );
}
