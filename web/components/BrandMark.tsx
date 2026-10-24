/**
 * SpawnPad official emblem — the "spawn trajectory".
 * Two angular nib-arrows with ring nodes trace an S: the portal through
 * which tokens are born. Cyan→azure up top, violet→magenta below.
 * Portrait geometry on a 100×224 canvas; renders crisp at any size.
 */

function TrajectoryDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="95" y1="5" x2="15" y2="215" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#2BE5FF" />
        <stop offset="0.38" stopColor="#4E86FF" />
        <stop offset="0.68" stopColor="#8B5CF6" />
        <stop offset="1" stopColor="#E73BD6" />
      </linearGradient>
    </defs>
  );
}

function TrajectoryBody({ id }: { id: string }) {
  return (
    <g>
      {/* trajectory bands (gap where each ring node sits) */}
      <path d="M57.5 169 L76 154 L24 70 L42.9 54.6" stroke={`url(#${id})`} strokeWidth="14" fill="none" strokeLinejoin="round" />
      <path d="M15.1 203.5 L44.2 179.8" stroke={`url(#${id})`} strokeWidth="14" fill="none" />
      <path d="M56.1 43.9 L84.9 20.5" stroke={`url(#${id})`} strokeWidth="14" fill="none" />
      {/* nib arrowheads */}
      <path d="M99 1 L91 27 L97 54 L79 34 L66 24 L74 9 Z" fill={`url(#${id})`} />
      <path d="M1 223 L9 197 L3 170 L21 178 L34 200 L26 215 Z" fill={`url(#${id})`} />
      {/* ring nodes (band gaps behind them) */}
      <circle cx="49.5" cy="49.3" r="8.5" stroke={`url(#${id})`} strokeWidth="3.5" fill="none" />
      <circle cx="51" cy="174" r="8.5" stroke={`url(#${id})`} strokeWidth="3.5" fill="none" />
    </g>
  );
}

/** Inline emblem — `size` = rendered HEIGHT in px (portrait mark, ratio 100:224). */
export function BrandMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={(size * 100) / 224}
      height={size}
      viewBox="0 0 100 224"
      fill="none"
      role="img"
      aria-label="SpawnPad emblem"
      className={className}
    >
      <TrajectoryDefs id="bmTraj" />
      <TrajectoryBody id="bmTraj" />
    </svg>
  );
}

/** Full lockup — trajectory emblem + SpawnPad wordmark (dark surfaces). */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 262 96" fill="none" className={className} role="img" aria-label="SpawnPad">
      <TrajectoryDefs id="blTraj" />
      <g transform="scale(0.4286)">
        <TrajectoryBody id="blTraj" />
      </g>
      <defs>
        <linearGradient id="blPad" x1="212" y1="0" x2="318" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#42E8FF" />
          <stop offset="1" stopColor="#9670FF" />
        </linearGradient>
      </defs>
      <g transform="translate(62 20) scale(0.6)" strokeWidth="7" strokeLinecap="round">
        <path d="M29 13 C29 8 24 6 16 6 C8 6 3 10 3 17 C3 24 8 27 16 29 C24 31 29 34 29 41 C29 48 24 52 16 52 C8 52 3 49 3 44" stroke="#F4F7FF" />
        <path d="M45 24 C49 19 55 17 60 17 C68 17 73 23 73 33 C73 43 68 50 60 50 C55 50 49 48 45 44" stroke="#F4F7FF" />
        <path d="M45 14 L45 64" stroke="#F4F7FF" />
        <path d="M107 24 C104 20 100 18 95 18 C88 18 84 24 84 34 C84 44 88 50 95 50 C100 50 104 48 107 44" stroke="#F4F7FF" />
        <path d="M107 18 L107 50" stroke="#F4F7FF" />
        <path d="M122 18 L130 50 L140 27 L150 50 L158 18" stroke="#F4F7FF" strokeLinejoin="round" />
        <path d="M173 18 L173 50" stroke="#F4F7FF" />
        <path d="M173 28 C176 21 181 18 186 18 C193 18 197 23 197 31 L197 50" stroke="#F4F7FF" />
        <path d="M213 52 L213 6 L228 6 C236 6 240 11 240 19 C240 27 236 32 228 32 L213 32" stroke="url(#blPad)" strokeLinejoin="round" />
        <path d="M275 24 C272 20 268 18 263 18 C256 18 252 24 252 34 C252 44 256 50 263 50 C268 50 272 48 275 44" stroke="url(#blPad)" />
        <path d="M275 18 L275 50" stroke="url(#blPad)" />
        <path d="M315 24 C312 20 308 18 303 18 C296 18 292 24 292 34 C292 44 296 50 303 50 C308 50 312 48 315 44" stroke="url(#blPad)" />
        <path d="M315 6 L315 50" stroke="url(#blPad)" />
      </g>
    </svg>
  );
}
