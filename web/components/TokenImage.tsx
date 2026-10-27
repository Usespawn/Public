"use client";

/**
 * Token logo with IPFS gateway fallback.
 *
 * Resolution order (pure logic in lib/metadata/gateway.ts, unit-tested):
 *   1. the URL host embedded in the stored image URI (often a dedicated
 *      gateway such as gateway.pinata.cloud);
 *   2. ipfs.io → gateway.pinata.cloud → dweb.link → cloudflare-ipfs.com.
 *
 * States: loading (dimmed pulse) → image → on error, next gateway → after
 * every candidate fails, the existing letter avatar is shown. The layout
 * box is fixed by the caller so fallbacks never shift the page.
 */
import { useMemo, useState } from "react";
import { imageGatewayCandidates } from "@/lib/metadata/gateway";

export function TokenImage({
  uri,
  name,
  symbol,
  className,
}: {
  uri?: string | null;
  name?: string | null;
  symbol?: string | null;
  className?: string;
}) {
  const candidates = useMemo(() => imageGatewayCandidates(uri), [uri]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const hasImage = candidates.length > 0 && index < candidates.length;

  return (
    <div
      className={
        "relative overflow-hidden " +
        (className ??
          "grid size-14 shrink-0 place-items-center rounded-2xl bg-acid/15")
      }
    >
      {hasImage ? (
        <>
          {!loaded && (
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse bg-raised/60"
            />
          )}
          <img
            src={candidates[index]}
            alt={name ? `${name} logo` : "token logo"}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(false);
              setIndex((i) => i + 1); // next gateway; may exhaust candidates
            }}
            className={
              "size-full object-cover transition-opacity duration-300 " +
              (loaded ? "opacity-100" : "opacity-0")
            }
          />
        </>
      ) : (
        <span
          aria-label="token logo placeholder"
          className="font-display text-xl font-bold text-acid"
        >
          {(symbol || name || "SP").trim().slice(0, 3).toUpperCase() || "SP"}
        </span>
      )}
    </div>
  );
}