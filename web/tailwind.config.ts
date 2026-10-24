import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // SpawnPad Universe — midnight-blue identity (never pure black)
        obsidian: "#0B1124", // main background — deep midnight
        sea: "#101A35", // alternate section background
        panel: "#15213F", // elevated surfaces
        raised: "#1A2B4D", // interactive surfaces
        line: "#293B60", // subtle border
        "line-strong": "#3A527B", // emphasized border
        ink: "#F4F7FF", // primary text
        muted: "#A6B5D4", // secondary text
        faint: "#7484A6", // muted text
        acid: {
          DEFAULT: "#42E8FF", // electric cyan — primary interactions
          dim: "#2BB6D9",
        },
        violet: "#9670FF", // cosmic violet — atmospheric depth
        blue: "#5885FF", // laser blue — tertiary
        crimson: "#FF537A", // crimson accent — used sparingly
        ok: "#50E3A4",
        warn: "#FFC857",
        err: "#FF647C",
        // Legacy aliases → new palette (existing pages re-theme automatically)
        mint: {
          DEFAULT: "#42E8FF",
          deep: "#5885FF",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 36px rgba(66, 232, 255, 0.18)",
        glowv: "0 0 36px rgba(150, 112, 255, 0.18)",
        panel: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 12px 40px rgba(4,9,26,0.45)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(-6px)" },
          "50%": { transform: "translateY(8px)" },
        },
        scan: {
          "0%": { top: "-10%" },
          "100%": { top: "110%" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.15" },
          "50%": { opacity: "0.7" },
        },
        revealChar: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        blink: "blink 1.1s steps(1) infinite",
        fadeUp: "fadeUp .5s ease both",
        orbit: "orbit 24s linear infinite",
        "float-y": "float-y 7s ease-in-out infinite",
        scan: "scan 1.6s linear infinite",
        twinkle: "twinkle 4s ease-in-out infinite",
        revealChar: "revealChar .35s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
