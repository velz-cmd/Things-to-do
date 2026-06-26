"use client";

/** Atmospheric canvas — Luna / Boltshift / Agex inspired. No grid. */
export function ResolveBackground({ variant = "app" }: { variant?: "app" | "hero" | "minimal" }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0 bg-[#04060d]" />

      {/* Aurora layers */}
      <div
        className="absolute -left-[20%] top-[-30%] h-[70vh] w-[70vw] rounded-full opacity-40 blur-[120px] animate-aurora-a"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.35) 0%, rgba(59,130,246,0.12) 40%, transparent 70%)",
        }}
      />
      <div
        className="absolute -right-[15%] top-[5%] h-[55vh] w-[55vw] rounded-full opacity-30 blur-[100px] animate-aurora-b"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(99,102,241,0.1) 45%, transparent 70%)",
        }}
      />
      {variant !== "minimal" && (
        <div
          className="absolute bottom-[-20%] left-[20%] h-[50vh] w-[60vw] rounded-full opacity-25 blur-[110px] animate-aurora-c"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.2) 0%, rgba(59,130,246,0.08) 50%, transparent 70%)",
          }}
        />
      )}

      {/* Horizon line glow (hero) */}
      {variant === "hero" && (
        <div className="absolute left-0 right-0 top-[42%] h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
      )}

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(4,6,13,0.4)_100%)]" />

      {/* Fine grain */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
