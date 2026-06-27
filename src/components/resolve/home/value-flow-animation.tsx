"use client";

const STEPS = [
  "Contribution detected",
  "Attribution resolved",
  "Value recognized",
  "Policy recommended",
  "Capital authorized",
  "Arc batch settlement",
  "Wallet receives USDC",
] as const;

/** Animated value pipeline — explains the company without reading docs. */
export function ValueFlowAnimation() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="absolute -inset-8 rounded-3xl opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,122,255,0.25) 0%, transparent 70%)",
        }}
      />
      <div className="relative space-y-0 rounded-2xl border border-resolve-border/80 bg-resolve-bg-deep/60 p-6 backdrop-blur-sm">
        {STEPS.map((label, i) => (
          <div key={label} className="relative flex items-center gap-4 py-2.5">
            {i < STEPS.length - 1 && (
              <span
                className="absolute left-[11px] top-10 h-[calc(100%-4px)] w-px bg-gradient-to-b from-resolve-accent/40 to-transparent animate-resolve-flow-line"
                style={{ animationDelay: `${i * 0.9}s` }}
              />
            )}
            <span
              className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-resolve-accent/30 bg-resolve-bg text-[10px] font-bold text-resolve-accent-bright animate-resolve-flow-node"
              style={{ animationDelay: `${i * 0.9}s` }}
            >
              {i + 1}
            </span>
            <span
              className="text-sm text-resolve-muted animate-resolve-flow-label"
              style={{ animationDelay: `${i * 0.9}s` }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
