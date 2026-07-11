import clsx from "clsx";

type GlowCardVariant = "blue" | "orange" | "subtle";

const variants: Record<GlowCardVariant, string> = {
  blue: "resolve-glass resolve-blue-glow",
  orange:
    "border border-orange-400/20 bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent shadow-resolve-orange",
  subtle: "resolve-glass-subtle",
};

/** Signature card — blue glass + bottom neon glow + internal grid */
export function BlueGlowCard({
  children,
  className,
  variant = "blue",
  hover = true,
  grid = true,
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: GlowCardVariant;
  hover?: boolean;
  grid?: boolean;
  padding?: boolean;
}) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[var(--radius-card)]",
        variants[variant],
        hover && "resolve-card-hover resolve-interactive-card",
        padding && "p-5",
        className,
      )}
    >
      {grid && variant === "blue" && (
        <div
          aria-hidden
          className="resolve-card-grid pointer-events-none absolute inset-0 opacity-60"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 30%, black 100%)",
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
