"use client";

/** Central energy orb — Boltshift / Agex inspired */
export function HeroOrb() {
  return (
    <div aria-hidden className="pointer-events-none relative mx-auto h-48 w-48 md:h-56 md:w-56">
      {/* Outer rings */}
      <div className="absolute inset-0 animate-resolve-orb-spin rounded-full border border-cyan-400/10" style={{ animationDuration: "24s" }} />
      <div
        className="absolute inset-3 animate-resolve-orb-spin rounded-full border border-indigo-400/15"
        style={{ animationDuration: "18s", animationDirection: "reverse" }}
      />

      {/* Core glow */}
      <div className="absolute inset-6 rounded-full bg-gradient-to-br from-cyan-400/30 via-indigo-500/25 to-violet-500/20 blur-sm animate-resolve-pulse-glow" />

      {/* Core sphere */}
      <div className="absolute inset-8 rounded-full bg-gradient-to-br from-cyan-300/40 via-indigo-400/30 to-violet-500/25 shadow-[0_0_60px_rgba(56,189,248,0.4),inset_0_0_30px_rgba(255,255,255,0.15)] animate-resolve-float" />

      {/* Highlight */}
      <div className="absolute left-[30%] top-[22%] h-8 w-8 rounded-full bg-white/25 blur-md" />
    </div>
  );
}
