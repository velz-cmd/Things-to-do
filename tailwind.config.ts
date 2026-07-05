import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        resolve: {
          bg: "#060f1c",
          "bg-deep": "#040a14",
          raised: "rgba(14,32,58,0.88)",
          hover: "rgba(22,48,82,0.72)",
          surface: "rgba(10,30,62,0.55)",
          panel: "rgba(14,32,58,0.88)",
          border: "rgba(125,140,196,0.18)",
          "border-strong": "rgba(125,140,196,0.32)",
          accent: "#7d8cc4",
          "accent-bright": "#0077b3",
          "accent-muted": "rgba(125,140,196,0.18)",
          glow: "rgba(0,119,179,0.42)",
          calm: {
            canvas: "#F2E8E5",
            card: "#CCC2D1",
            periwinkle: "#7D8CC4",
            blue: "#0077B3",
            rose: "#DE7499",
            sage: "#BCC5BC",
            lilac: "#5C609F",
            alert: "#CD4C4C",
          },
          brand: {
            iris: "#5C609F",
            aster: "#0077B3",
            periwinkle: "#7D8CC4",
          },
          orange: "#ff7a45",
          "orange-muted": "rgba(255,122,69,0.15)",
          primary: "#7d8cc4",
          success: "#34d399",
          warning: "#fbbf24",
          danger: "#f87171",
          muted: "#a8b8d4",
          "muted-dim": "#7a92b4",
        },
        deputy: {
          bg: "#071428",
          panel: "rgba(12,35,72,0.65)",
          border: "rgba(100,160,255,0.12)",
          accent: "#3b9eff",
          warn: "#fbbf24",
          danger: "#f87171",
          muted: "#8ba3c7",
        },
      },
      borderRadius: {
        resolve: "18px",
        "resolve-lg": "24px",
        "resolve-xl": "28px",
      },
      boxShadow: {
        resolve: "0 8px 32px rgba(0,40,100,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
        "resolve-blue": "0 0 40px rgba(0,122,255,0.25), 0 12px 40px rgba(0,60,140,0.15)",
        "resolve-orange": "0 0 40px rgba(255,122,69,0.2), 0 12px 40px rgba(180,60,20,0.12)",
        "resolve-accent": "0 4px 24px rgba(0,122,255,0.35), 0 0 0 1px rgba(59,158,255,0.2)",
        "resolve-glow": "0 0 48px rgba(0,122,255,0.4), 0 8px 32px rgba(0,60,140,0.25)",
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
