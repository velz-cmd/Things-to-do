"use client";

import clsx from "clsx";

/** Central energy orb — pure electric blue, Boltshift-inspired */
export function HeroOrb({ size = "md" }: { size?: "md" | "lg" }) {
  const dims = size === "lg" ? "h-52 w-52 md:h-60 md:w-60" : "h-44 w-44 md:h-52 md:w-52";

  return (
    <div aria-hidden className={clsx("pointer-events-none relative", dims)}>
      <div
        className="absolute inset-0 animate-resolve-orb-spin rounded-full border border-resolve-accent/15"
        style={{ animationDuration: "24s" }}
      />
      <div
        className="absolute inset-3 animate-resolve-orb-spin rounded-full border border-resolve-accent-bright/20"
        style={{ animationDuration: "18s", animationDirection: "reverse" }}
      />

      <div className="absolute inset-6 rounded-full bg-gradient-to-br from-resolve-accent-bright/35 via-resolve-accent/25 to-blue-400/15 blur-sm animate-resolve-pulse-glow" />

      <div className="absolute inset-8 rounded-full bg-gradient-to-br from-blue-300/45 via-resolve-accent/35 to-resolve-accent-bright/30 shadow-[0_0_60px_rgba(0,122,255,0.45),inset_0_0_30px_rgba(255,255,255,0.12)] animate-resolve-float" />

      {/* Swirling light paths */}
      <div
        className="absolute inset-10 rounded-full opacity-60"
        style={{
          background:
            "conic-gradient(from 0deg, transparent, rgba(0,122,255,0.4), transparent, rgba(59,158,255,0.3), transparent)",
        }}
      />

      <div className="absolute left-[28%] top-[20%] h-10 w-10 rounded-full bg-white/30 blur-lg" />
    </div>
  );
}
