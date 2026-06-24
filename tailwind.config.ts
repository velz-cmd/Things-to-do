import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        resolve: {
          bg: "#05080c",
          raised: "#0c1219",
          hover: "#111a24",
          surface: "#0c1219",
          panel: "#111a24",
          border: "rgba(255,255,255,0.06)",
          "border-strong": "rgba(255,255,255,0.1)",
          accent: "#3b82f6",
          "accent-muted": "rgba(59,130,246,0.12)",
          primary: "#3b82f6",
          success: "#34d399",
          warning: "#fbbf24",
          danger: "#f87171",
          muted: "#94a3b8",
          "muted-dim": "#64748b",
        },
        deputy: {
          bg: "#05080c",
          panel: "#0c1219",
          border: "rgba(255,255,255,0.06)",
          accent: "#3b82f6",
          warn: "#fbbf24",
          danger: "#f87171",
          muted: "#94a3b8",
        },
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
