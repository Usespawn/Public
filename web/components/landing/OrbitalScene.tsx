"use client";

/**
 * SpawnPad hero orbital scene — a luminous core with layered orbits,
 * floating fragments and particles. Built from SVG + CSS transforms
 * (GPU-friendly, no 3D dependency). Mouse parallax is pointer-fine only
 * and disabled under prefers-reduced-motion. All positions are
 * deterministic (no hydration mismatch).
 */
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { MANDATORY_SUFFIX } from "@/lib/config";

/** Deterministic particle field: [x%, y%, size, delayMs, tone] */
const PARTICLES: Array<[number, number, number, number, "acid" | "violet" | "blue"]> = [
  [6, 18, 2.5, 0, "acid"],
  [12, 62, 2, 900, "violet"],
  [22, 8, 2, 1800, "blue"],
  [30, 84, 3, 400, "acid"],
  [38, 14, 1.5, 1300, "violet"],
  [55, 5, 2, 2200, "acid"],
  [68, 12, 2.5, 700, "blue"],
  [80, 22, 1.5, 1500, "acid"],
  [90, 40, 2, 100, "violet"],
  [86, 68, 2.5, 2000, "acid"],
  [76, 88, 2, 500, "blue"],
  [58, 92, 1.5, 1700, "acid"],
  [44, 72, 2, 1100, "violet"],
  [18, 40, 1.5, 2400, "blue"],
  [94, 14, 1.5, 300, "acid"],
  [8, 86, 2, 1900, "violet"],
];

const FRAGMENTS = [
  { x: "16%", y: "22%", size: 14, rotate: 18, dur: "8s", delay: "0s", border: "border-acid/40" },
  { x: "78%", y: "16%", size: 10, rotate: -12, dur: "10s", delay: "1.2s", border: "border-violet/40" },
  { x: "70%", y: "78%", size: 12, rotate: 30, dur: "9s", delay: "0.6s", border: "border-blue/40" },
];

const tone = { acid: "bg-acid", violet: "bg-violet", blue: "bg-blue" } as const;

export function OrbitalScene() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [finePointer, setFinePointer] = useState(false);

  // Mouse parallax — pointer-fine devices only, skipped under reduced motion.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 18, mass: 0.7 });
  const sy = useSpring(my, { stiffness: 55, damping: 18, mass: 0.7 });
  const coreX = useTransform(sx, (v) => v * 8);
  const coreY = useTransform(sy, (v) => v * 8);
  const ringsX = useTransform(sx, (v) => v * 15);
  const ringsY = useTransform(sy, (v) => v * 15);
  const farX = useTransform(sx, (v) => v * 24);
  const farY = useTransform(sy, (v) => v * 24);

  useEffect(() => {
    if (reduce) return;
    const mq = window.matchMedia("(pointer: fine)");
    setFinePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setFinePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [reduce]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!finePointer || reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative mx-auto aspect-square w-full max-w-[480px] select-none lg:max-w-[520px]"
      aria-hidden="true"
    >
      {/* Ambient light fields */}
      <div className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid/[0.07] blur-3xl" />
      <div className="absolute left-[8%] top-[60%] size-[38%] rounded-full bg-violet/[0.09] blur-3xl" />
      <div className="absolute right-[4%] top-[8%] size-[30%] rounded-full bg-blue/[0.08] blur-3xl" />

      {/* Particle field (far layer) */}
      <motion.div style={reduce ? undefined : { x: farX, y: farY }} className="absolute inset-0">
        {PARTICLES.map(([x, y, s, d, t], i) => (
          <span
            key={i}
            className={`animate-twinkle absolute rounded-full opacity-40 ${tone[t]}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: s,
              height: s,
              animationDelay: `${d}ms`,
              animationDuration: `${3600 + (i % 5) * 900}ms`,
            }}
          />
        ))}
      </motion.div>

      {/* Orbit system (middle layer) */}
      <motion.div style={reduce ? undefined : { x: ringsX, y: ringsY }} className="absolute inset-0">
        <div className="absolute inset-[4%]" style={{ perspective: 1000 }}>
          <div className="absolute inset-0" style={{ transform: "rotateX(58deg)" }}>
            <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#42E8FF" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#9670FF" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              <circle cx="200" cy="200" r="78" fill="none" stroke="#293B60" strokeWidth="1" strokeDasharray="2 6" />
              <circle cx="200" cy="200" r="122" fill="none" stroke="#293B60" strokeWidth="1" strokeDasharray="2 6" />
              <circle cx="200" cy="200" r="166" fill="none" stroke="#293B60" strokeWidth="1" strokeDasharray="2 6" />
              <g className="animate-orbit" style={{ transformOrigin: "200px 200px", animationDuration: "22s" }}>
                <circle cx="200" cy="200" r="78" fill="none" stroke="url(#ringGrad)" strokeWidth="1.2" strokeDasharray="70 420" strokeLinecap="round" />
                <circle cx="278" cy="200" r="4" fill="#42E8FF" />
                <circle cx="278" cy="200" r="8" fill="#42E8FF" opacity="0.25" />
              </g>
              <g className="animate-orbit" style={{ transformOrigin: "200px 200px", animationDuration: "34s", animationDirection: "reverse" }}>
                <circle cx="200" cy="200" r="122" fill="none" stroke="url(#ringGrad)" strokeWidth="1.2" strokeDasharray="110 655" strokeLinecap="round" />
                <circle cx="322" cy="200" r="3.5" fill="#9670FF" />
                <circle cx="322" cy="200" r="7" fill="#9670FF" opacity="0.25" />
              </g>
              <g className="animate-orbit" style={{ transformOrigin: "200px 200px", animationDuration: "46s" }}>
                <circle cx="200" cy="200" r="166" fill="none" stroke="url(#ringGrad)" strokeWidth="1.2" strokeDasharray="150 892" strokeLinecap="round" />
                <circle cx="366" cy="200" r="3" fill="#5885FF" />
                <circle cx="366" cy="200" r="6" fill="#5885FF" opacity="0.25" />
              </g>
            </svg>
          </div>
        </div>
      </motion.div>

      {/* Floating fragments (near layer) */}
      <motion.div style={reduce ? undefined : { x: farX, y: farY }} className="absolute inset-0">
        {FRAGMENTS.map((f, i) => (
          <span
            key={i}
            className={`animate-float-y absolute rounded-[3px] border bg-panel/60 backdrop-blur-sm ${f.border}`}
            style={{
              left: f.x,
              top: f.y,
              width: f.size,
              height: f.size,
              transform: `rotate(${f.rotate}deg)`,
              animationDuration: f.dur,
              animationDelay: f.delay,
            }}
          />
        ))}
      </motion.div>

      {/* Energy core (focal layer) */}
      <motion.div
        style={reduce ? undefined : { x: coreX, y: coreY }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative grid size-36 place-items-center sm:size-44">
          <div className="absolute inset-0 rounded-full bg-acid/20 blur-2xl" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-acid via-blue to-violet opacity-90 blur-[1px]" />
          <div className="absolute inset-3 rounded-full bg-panel/90" />
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[#EAFBFF] via-acid to-blue shadow-glow" />
          <div className="absolute inset-0 animate-orbit rounded-full border border-dashed border-acid/50" style={{ animationDuration: "14s" }} />
          <div className="absolute inset-[-14px] rounded-full border border-violet/20" />
        </div>
      </motion.div>

      {/* Spw mint motif chip */}
      <motion.div style={reduce ? undefined : { x: ringsX, y: ringsY }} className="absolute right-[6%] top-[26%]">
        <div className="animate-float-y glass flex items-center gap-2 rounded-lg px-3 py-2 shadow-glow">
          <span className="size-1.5 rounded-full bg-acid" />
          <span className="font-mono text-[12px] text-ink">
            7xKq…<span className="font-bold text-acid">{MANDATORY_SUFFIX}</span>
          </span>
        </div>
      </motion.div>

      {/* Engine-fact chip */}
      <motion.div style={reduce ? undefined : { x: coreX, y: coreY }} className="absolute bottom-[18%] left-[4%]">
        <div className="animate-float-y glass flex items-center gap-2 rounded-lg px-3 py-2" style={{ animationDelay: "1.4s" }}>
          <span className="size-1.5 rounded-full bg-violet" />
          <span className="font-mono text-[11px] text-muted">58³ ≈ 195,112 attempts</span>
        </div>
      </motion.div>
    </div>
  );
}
