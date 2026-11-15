import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-subtle": "var(--bg-subtle)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-fg": "var(--accent-fg)",
        "accent-soft": "var(--accent-soft)",
        "accent-ink": "var(--accent-ink)",
        ring: "var(--ring)",
        critical: "var(--critical)",
        "critical-soft": "var(--critical-soft)",
        high: "var(--high)",
        "high-soft": "var(--high-soft)",
        medium: "var(--medium)",
        "medium-soft": "var(--medium-soft)",
        low: "var(--low)",
        "low-soft": "var(--low-soft)",
        cleared: "var(--cleared)",
        "cleared-soft": "var(--cleared-soft)",
        verified: "var(--verified)",
        "verified-soft": "var(--verified-soft)",
        mismatch: "var(--mismatch)",
        "mismatch-soft": "var(--mismatch-soft)",
        pending: "var(--pending)",
        "pending-soft": "var(--pending-soft)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        "display-xl": ["clamp(2.9rem, 6.2vw, 5.4rem)", { lineHeight: "0.98", letterSpacing: "-0.045em" }],
        "display-lg": ["clamp(2.3rem, 4.4vw, 3.9rem)", { lineHeight: "1.03", letterSpacing: "-0.035em" }],
        "display-md": ["clamp(1.85rem, 3.2vw, 2.75rem)", { lineHeight: "1.08", letterSpacing: "-0.03em" }],
        "display-sm": ["clamp(1.5rem, 2.2vw, 2rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
      },
      maxWidth: {
        page: "1224px",
        prose: "68ch",
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        "2xl": "28px",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        ring: "0 0 0 1px var(--border)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.35", transform: "scale(0.85)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%, -2%, 0) scale(1.04)" },
        },
      },
      animation: {
        marquee: "marquee 48s linear infinite",
        "fade-up": "fade-up 500ms cubic-bezier(0.22,1,0.36,1) both",
        "pulse-dot": "pulse-dot 2.4s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [typography],
};

export default config;
