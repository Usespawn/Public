"use client";

/**
 * DIGITAL GENESIS — SPAWNPAD
 *
 * Original hero animation: the birth of a new digital asset through a
 * futuristic circuit system.
 *
 *  - A luminous electric-cyan core (the genesis point) illuminates.
 *  - Thin angular circuit traces — bends echoing the official S-trajectory
 *    emblem geometry — light up in sequence and flow their energy through.
 *  - Small glowing nodes travel along the traces (SMIL animateMotion —
 *    plain SVG, zero JS per frame).
 *  - A thin energy ring expands outward and fades (twice per cycle).
 *  - The official SpawnPad emblem receives a restrained cyan→violet
 *    highlight near the end of the sequence.
 *  - Smooth 8s seamless loop; every stage returns to its initial state.
 *
 * Implementation notes:
 *  - SVG + CSS keyframes only (no Canvas/WebGL, no extra dependencies).
 *  - Deterministic geometry: no randomness, no dates → no hydration risk.
 *  - `prefers-reduced-motion`: all keyframe animation is disabled in CSS and
 *    traveling nodes are not rendered → the scene falls back to a fully-lit
 *    static composition.
 *  - Pointer parallax is ±7px, fine-pointer devices only, reduced-motion
 *    aware, mounted-gated (never rendered on the server).
 *  - The banner artwork is NOT part of this component and is never animated.
 */
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

/* Angular circuit traces converging on the genesis core (45° bends). */
const TRACES = [
  { id: "dgPathA", d: "M 34 396 L 122 396 L 168 350 L 168 306", pad: [34, 396], delay: "0s", tone: "#42E8FF" },
  { id: "dgPathB", d: "M 396 116 L 318 116 L 260 174 L 260 196", pad: [396, 116], delay: ".35s", tone: "#5885FF" },
  { id: "dgPathC", d: "M 52 78 L 138 78 L 186 126 L 186 172", pad: [52, 78], delay: ".7s", tone: "#9670FF" },
  { id: "dgPathD", d: "M 384 352 L 306 352 L 268 314", pad: [384, 352], delay: "1.05s", tone: "#42E8FF" },
] as const;

/* Traveling nodes — one per major trace, desynchronized begins. */
const NODES = [
  { path: "dgPathA", dur: "5.2s", begin: "0s", r: 3, fill: "#42E8FF" },
  { path: "dgPathB", dur: "6.4s", begin: "1.1s", r: 2.5, fill: "#9670FF" },
  { path: "dgPathC", dur: "5.8s", begin: "2.3s", r: 2.5, fill: "#5885FF" },
  { path: "dgPathD", dur: "4.6s", begin: "0.6s", r: 2, fill: "#42E8FF" },
] as const;

/** Official SpawnPad trajectory emblem (synced with BrandMark.tsx / make-logo-assets.js). */
function EmblemBody({ id }: { id: string }) {
  return (
    <g>
      <path d="M57.5 169 L76 154 L24 70 L42.9 54.6" stroke={`url(#${id})`} strokeWidth="14" fill="none" strokeLinejoin="round" />
      <path d="M15.1 203.5 L44.2 179.8" stroke={`url(#${id})`} strokeWidth="14" fill="none" />
      <path d="M56.1 43.9 L84.9 20.5" stroke={`url(#${id})`} strokeWidth="14" fill="none" />
      <path d="M99 1 L91 27 L97 54 L79 34 L66 24 L74 9 Z" fill={`url(#${id})`} />
      <path d="M1 223 L9 197 L3 170 L21 178 L34 200 L26 215 Z" fill={`url(#${id})`} />
      <circle cx="49.5" cy="49.3" r="8.5" stroke={`url(#${id})`} strokeWidth="3.5" fill="none" />
      <circle cx="51" cy="174" r="8.5" stroke={`url(#${id})`} strokeWidth="3.5" fill="none" />
    </g>
  );
}

export function DigitalGenesis() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [fine, setFine] = useState(false);

  // Subtle pointer parallax (fine-pointer desktop only, never under reduced motion).
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 18, mass: 0.7 });
  const sy = useSpring(my, { stiffness: 55, damping: 18, mass: 0.7 });
  const px = useTransform(sx, (v) => v * 7);
  const py = useTransform(sy, (v) => v * 7);

  useEffect(() => {
    setMounted(true);
    if (reduce) return;
    const mq = window.matchMedia("(pointer: fine)");
    setFine(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setFine(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [reduce]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mounted || !fine || reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  // Mounted-gated rendering keeps SSR markup deterministic (hydration-safe).
  const showNodes = mounted && !reduce;
  const parallaxStyle = mounted && !reduce && fine ? { x: px, y: py } : undefined;

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative mx-auto w-full max-w-[340px] select-none sm:max-w-[420px] lg:max-w-[480px]"
      aria-hidden="true"
    >
      {/* Ambient illumination — static light fields */}
      <div className="absolute -inset-8 rounded-[40px] bg-acid/[0.06] blur-3xl" />
      <div className="absolute -inset-8 rounded-[40px] bg-violet/[0.05] blur-3xl" />

      <div className="glass relative overflow-hidden rounded-3xl shadow-panel">
        <div className="dot-matrix-fine pointer-events-none absolute inset-0 opacity-60" />

        <motion.div style={parallaxStyle} className="relative aspect-square w-full">
          <svg viewBox="0 0 420 420" className="h-full w-full" fill="none">
  <defs>
    {/* Genesis core glow */}
    <radialGradient
      id="dgGlow"
      cx="0"
      cy="0"
      r="1"
      gradientUnits="userSpaceOnUse"
      gradientTransform="translate(210 240) scale(80)"
    >
      <stop offset="0" stopColor="#42E8FF" stopOpacity="0.5" />
      <stop offset="0.45" stopColor="#2BB6D9" stopOpacity="0.16" />
      <stop offset="1" stopColor="#2BB6D9" stopOpacity="0" />
    </radialGradient>
    {/* Official emblem gradient (mirrors BrandMark) */}
    <linearGradient id="dgEm" x1="99" y1="1" x2="1" y2="223" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#2BE5FF" />
      <stop offset="0.45" stopColor="#4E86FF" />
      <stop offset="0.75" stopColor="#8B5CF6" />
      <stop offset="1" stopColor="#E73BD6" />
    </linearGradient>
    {/* Brief end-of-sequence highlight sweep */}
    <linearGradient id="dgHi" x1="99" y1="1" x2="1" y2="223" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#BFF6FF" />
      <stop offset="0.5" stopColor="#7DF0FF" />
      <stop offset="1" stopColor="#C9A6FF" />
    </linearGradient>
    <filter id="dgSoft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" />
    </filter>
  </defs>

  {/* Guide circles — quiet geometry framing the composition */}
  <circle cx="210" cy="240" r="152" stroke="#293B60" strokeWidth="1" strokeDasharray="3 9" opacity="0.55" className="dg-spin" />
  <circle cx="210" cy="240" r="188" stroke="#293B60" strokeWidth="1" opacity="0.28" />

  {/* Circuit traces — draw in sequence, flow through, return */}
  <g style={{ filter: "drop-shadow(0 0 5px rgba(66,232,255,0.28))" }}>
    {TRACES.map((t) => (
      <path
        key={t.id}
        id={t.id}
        d={t.d}
        pathLength={1}
        stroke={t.tone}
        strokeWidth="1.6"
        strokeLinejoin="round"
        className="dg-draw"
        style={{ animationDelay: t.delay }}
      />
    ))}
  </g>

  {/* Contact pads at trace origins */}
  {TRACES.map((t) => (
    <rect
      key={`pad-${t.id}`}
      x={t.pad[0] - 3.5}
      y={t.pad[1] - 3.5}
      width="7"
      height="7"
      rx="1.5"
      fill={t.tone}
      className="dg-pad"
      style={{ animationDelay: t.delay }}
    />
  ))}

  {/* Thin energy rings — expand outward and fade */}
  <circle className="dg-ring" cx="210" cy="240" r="62" stroke="#42E8FF" strokeWidth="1.4" opacity="0" />
  <circle className="dg-ring dg-ring-b" cx="210" cy="240" r="62" stroke="#9670FF" strokeWidth="1.1" opacity="0" />

  {/* Luminous genesis core */}
  <circle className="dg-core" cx="210" cy="240" r="80" fill="url(#dgGlow)" opacity="0" />
  <g className="dg-core-pulse">
    <circle cx="210" cy="240" r="14" fill="#42E8FF" opacity="0.28" />
    <circle cx="210" cy="240" r="9" fill="#EAFCFF" />
    <circle cx="210" cy="240" r="13" stroke="#42E8FF" strokeWidth="1.2" opacity="0.7" />
  </g>

  {/* Official SpawnPad emblem — brief highlight at sequence end */}
  <g transform="translate(184 180) scale(0.52)">
    <g opacity="0.88">
      <EmblemBody id="dgEm" />
    </g>
    <g className="dg-emblem-hi" filter="url(#dgSoft)" opacity="0">
      <EmblemBody id="dgHi" />
    </g>
  </g>

  {/* Traveling nodes — SMIL motion along the traces */}
  {showNodes && (
    <g className="dg-nodes">
      {NODES.map((n) => (
        <g key={n.path}>
          <circle r={n.r} fill={n.fill} opacity="0.9">
            <animateMotion dur={n.dur} begin={n.begin} repeatCount="indefinite" rotate="0">
              <mpath href={`#${n.path}`} />
            </animateMotion>
          </circle>
          <circle r={n.r * 2.2} fill={n.fill} opacity="0.18">
            <animateMotion dur={n.dur} begin={n.begin} repeatCount="indefinite" rotate="0">
              <mpath href={`#${n.path}`} />
            </animateMotion>
          </circle>
        </g>
      ))}
    </g>
  )}
</svg>
        </motion.div>

        {/* Scene caption */}
        <div className="relative border-t border-line/70 bg-panel/40 px-4 py-2.5 text-center">
          <span className="font-mono text-[10px] tracking-[0.32em] text-faint">
            DIGITAL GENESIS — SPAWNPAD
          </span>
        </div>
      </div>
    </div>
  );
}