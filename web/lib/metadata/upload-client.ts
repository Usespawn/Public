"use client";

/**
 * Browser-side upload helpers for the launch wizard.
 * Requires the server API routes (which hold the Pinata credentials).
 */
import { validateImageFile } from "./upload";

export interface UploadedContent {
  cid: string;
  /** Publicly resolvable https URL of the content. */
  url: string;
}

/** Explicit, user-initiated image upload with progress callbacks (0-100). */
export function uploadImageToIpfs(
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadedContent> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const clientError = await validateImageFile(file);
      if (clientError) {
        reject(new Error(clientError));
        return;
      }

    const form = new FormData();
    form.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/metadata/upload");
    xhr.responseType = "json";

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onerror = () => reject(new Error("image upload failed — network error"));
    xhr.ontimeout = () => reject(new Error("image upload timed out — try again"));
    xhr.onload = () => {
      try {
        const body = xhr.response as { ok?: boolean; cid?: string; url?: string; error?: string };
        if (xhr.status !== 200 || !body?.ok) {
          reject(new Error(body?.error || `image upload failed (HTTP ${xhr.status})`));
          return;
        }
        if (!body.cid || !body.url) {
          reject(new Error("image upload failed — incomplete server response"));
          return;
        }
        resolve({ cid: body.cid, url: body.url });
      } catch {
        reject(new Error("image upload failed — malformed server response"));
      }
    };

    xhr.send(form);
    })();
  });
}

/** Uploads the token metadata document; returns the final resolvable URI. */
export async function uploadMetadataToIpfs(metadata: {
  name: string;
  symbol: string;
  description?: string;
  imageUrl: string;
  website?: string;
  x?: string;
  telegram?: string;
}): Promise<UploadedContent> {
  const res = await fetch("/api/metadata/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  interface MetadataResponseBody {
    ok?: boolean;
    cid?: string;
    url?: string;
    error?: string;
  }
  let parsed: MetadataResponseBody | null = null;
  try {
    parsed = (await res.json()) as MetadataResponseBody;
  } catch {
    parsed = null; // malformed/non-JSON response — handled below
  }
  const body: MetadataResponseBody | null = parsed;
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `metadata upload failed (HTTP ${res.status})`);
  }
  if (!body.cid || !body.url) {
    throw new Error("metadata upload failed — incomplete server response");
  }
  return { cid: body.cid, url: body.url };
}