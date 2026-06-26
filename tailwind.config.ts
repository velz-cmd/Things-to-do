import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        resolve: {
          bg: "#030508",
          raised: "#0a0f16",
          hover: "#121a26",
          surface: "#0a0f16",
          panel: "#121a26",
          border: "rgba(255,255,255,0.07)",
          "border-strong": "rgba(255,255,255,0.12)",
          accent: "#4f8fff",
          "accent-muted": "rgba(79,143,255,0.14)",
          violet: "#8b5cf6",
          primary: "#4f8fff",
          success: "#34d399",
          warning: "#fbbf24",
          danger: "#f87171",
          muted: "#94a3b8",
          "muted-dim": "#64748b",
        },
        deputy: {
          bg: "#030508",
          panel: "#0a0f16",
          border: "rgba(255,255,255,0.07)",
          accent: "#4f8fff",
          warn: "#fbbf24",
          danger: "#f87171",
          muted: "#94a3b8",
        },
      },
      borderRadius: {
        resolve: "14px",
        "resolve-lg": "18px",
      },
      boxShadow: {
        resolve: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
        "resolve-accent": "0 8px 32px rgba(79,143,255,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
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
