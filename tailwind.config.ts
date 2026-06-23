import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        resolve: {
          bg: "#05080c",
          surface: "#0c1219",
          panel: "#111a24",
          border: "rgba(255,255,255,0.08)",
          primary: "#38bdf8",
          success: "#34d399",
          warning: "#fbbf24",
          danger: "#f87171",
          muted: "#94a3b8",
          proof: "#a78bfa",
        },
        deputy: {
          bg: "#05080c",
          panel: "#0c1219",
          border: "rgba(255,255,255,0.08)",
          accent: "#38bdf8",
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
