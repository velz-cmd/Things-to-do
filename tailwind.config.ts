import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        resolve: {
          bg: "#04060d",
          raised: "#0c1019",
          hover: "#141b28",
          surface: "#0c1019",
          panel: "#141b28",
          border: "rgba(255,255,255,0.06)",
          "border-strong": "rgba(255,255,255,0.11)",
          accent: "#38bdf8",
          "accent-2": "#818cf8",
          "accent-muted": "rgba(56,189,248,0.12)",
          violet: "#a78bfa",
          cyan: "#22d3ee",
          primary: "#38bdf8",
          success: "#34d399",
          warning: "#fbbf24",
          danger: "#f87171",
          muted: "#8b9cb3",
          "muted-dim": "#5c6b82",
        },
        deputy: {
          bg: "#04060d",
          panel: "#0c1019",
          border: "rgba(255,255,255,0.06)",
          accent: "#38bdf8",
          warn: "#fbbf24",
          danger: "#f87171",
          muted: "#8b9cb3",
        },
      },
      borderRadius: {
        resolve: "16px",
        "resolve-lg": "22px",
        "resolve-xl": "28px",
      },
      boxShadow: {
        resolve: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        "resolve-accent":
          "0 0 0 1px rgba(56,189,248,0.15), 0 12px 40px rgba(56,189,248,0.12), 0 0 60px rgba(129,140,248,0.08)",
        "resolve-glow": "0 0 40px rgba(56,189,248,0.25)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
