import clsx from "clsx";

type PanelVariant = "default" | "glass" | "glow" | "accent" | "flat";

export function Panel({
  children,
  className,
  padding = true,
  variant = "glass",
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  variant?: PanelVariant;
  hover?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-resolve-lg",
        variant === "default" && "border border-resolve-border-strong bg-resolve-raised",
        variant === "glass" && "resolve-glass resolve-card-glow",
        variant === "glow" &&
          "resolve-glass resolve-border-gradient resolve-card-glow-accent",
        variant === "accent" &&
          "resolve-border-gradient border-0 bg-gradient-to-br from-cyan-500/[0.08] via-indigo-500/[0.06] to-violet-500/[0.04] resolve-card-glow-accent backdrop-blur-xl",
        variant === "flat" && "border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm",
        hover && "resolve-card-hover cursor-default",
        padding && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
