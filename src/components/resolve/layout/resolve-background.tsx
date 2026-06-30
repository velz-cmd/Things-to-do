"use client";

/** Soft blue canvas — iris / aster / periwinkle pools on navy shell. */
export function ResolveBackground({ variant = "app" }: { variant?: "app" | "hero" | "minimal" }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base — site shell anchored to #071428 */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #0c1530 0%, #071428 38%, #050a14 100%)",
        }}
      />

      {/* Agex-style top light burst */}
      {variant === "hero" && (
        <>
          <div
            className="absolute left-1/2 top-0 h-[55vh] w-[90vw] -translate-x-1/2 animate-resolve-beam opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 50% 80% at 50% 0%, rgba(0,119,179,0.28) 0%, rgba(92,96,159,0.1) 42%, transparent 72%)",
            }}
          />
          <div
            className="absolute left-1/2 top-0 h-px w-[60%] -translate-x-1/2"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(125,140,196,0.45), transparent)",
              boxShadow: "0 0 40px 8px rgba(92,96,159,0.18)",
            }}
          />
        </>
      )}

      {/* Iris + blue aster ambient pools */}
      <div
        className="absolute -left-[10%] top-[18%] h-[50vh] w-[50vw] rounded-full opacity-35 blur-[100px]"
        style={{
          background: "radial-gradient(circle, rgba(92,96,159,0.22) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -right-[8%] bottom-[12%] h-[42vh] w-[46vw] rounded-full opacity-25 blur-[90px]"
        style={{
          background: "radial-gradient(circle, rgba(0,119,179,0.16) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute left-[30%] bottom-[5%] h-[35vh] w-[40vw] rounded-full opacity-20 blur-[80px]"
        style={{
          background: "radial-gradient(circle, rgba(125,140,196,0.14) 0%, transparent 70%)",
        }}
      />

      {/* Soft center spotlight for app pages */}
      {variant === "app" && (
        <div
          className="absolute left-1/2 top-0 h-[40vh] w-full -translate-x-1/2 opacity-45"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,119,179,0.1) 0%, rgba(92,96,159,0.06) 40%, transparent 72%)",
          }}
        />
      )}
    </div>
  );
}
