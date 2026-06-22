import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        deputy: {
          bg: "#0a0f14",
          panel: "#111a22",
          border: "#1e2d3a",
          accent: "#3dd68c",
          warn: "#f5a524",
          danger: "#f31260",
          muted: "#8b9aab",
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
