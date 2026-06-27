"use client";

/** Soft blue canvas — Agex top beam + Boltshift navy. Easy on the eyes. */
export function ResolveBackground({ variant = "app" }: { variant?: "app" | "hero" | "minimal" }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base — soft navy, not black */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #0a2040 0%, #071428 35%, #061020 100%)",
        }}
      />

      {/* Agex-style top light burst */}
      {variant === "hero" && (
        <>
          <div
            className="absolute left-1/2 top-0 h-[55vh] w-[90vw] -translate-x-1/2 animate-resolve-beam opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 50% 80% at 50% 0%, rgba(0,122,255,0.35) 0%, rgba(59,158,255,0.12) 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute left-1/2 top-0 h-px w-[60%] -translate-x-1/2"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(100,200,255,0.5), transparent)",
              boxShadow: "0 0 40px 8px rgba(0,122,255,0.2)",
            }}
          />
        </>
      )}

      {/* Ambient blue pools — subtle, no purple */}
      <div
        className="absolute -left-[10%] top-[20%] h-[50vh] w-[50vw] rounded-full opacity-30 blur-[100px]"
        style={{
          background: "radial-gradient(circle, rgba(0,122,255,0.2) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -right-[10%] bottom-[10%] h-[40vh] w-[45vw] rounded-full opacity-20 blur-[90px]"
        style={{
          background: "radial-gradient(circle, rgba(59,158,255,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Soft center spotlight for app pages */}
      {variant === "app" && (
        <div
          className="absolute left-1/2 top-0 h-[40vh] w-full -translate-x-1/2 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,122,255,0.12) 0%, transparent 70%)",
          }}
        />
      )}
    </div>
  );
}
