"use client";

/**
 * SpawnPad Universe motion primitives.
 * - Reveal: one-shot scroll reveal (skipped entirely under reduced motion).
 * - ScrollDrift: scroll-linked parallax translate via framer-motion useScroll
 *   (no scroll listeners, no React rerenders — pure transform updates).
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Wraps children in a container that drifts ±drift px as it crosses the
 * viewport. Spring-smoothed; disabled under reduced motion.
 */
export function ScrollDrift({
  children,
  className,
  drift = 40,
}: {
  children: React.ReactNode;
  className?: string;
  drift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const raw = useTransform(scrollYProgress, [0, 0.5, 1], [drift, 0, -drift]);
  const y = useSpring(raw, { stiffness: 60, damping: 20, mass: 0.6 });

  if (reduce) return <div className={className}>{children}</div>;
  return (
    // `relative` is required: framer-motion's useScroll measures the offset
    // of this container and warns when its position is static.
    <div ref={ref} className={`${className ?? ""} relative`}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
