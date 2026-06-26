import clsx from "clsx";

type PanelVariant = "default" | "glass" | "glow" | "accent" | "flat";

export function Panel({
  children,
  className,
  padding = true,
  variant = "glass",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  variant?: PanelVariant;
}) {
  return (
    <div
      className={clsx(
        "rounded-resolve-lg",
        variant === "default" && "border border-resolve-border-strong bg-resolve-raised",
        variant === "glass" && "resolve-glass resolve-card-glow",
        variant === "glow" && "resolve-glass resolve-card-glow-accent border border-resolve-accent/20",
        variant === "accent" &&
          "border border-resolve-accent/25 bg-gradient-to-br from-resolve-accent/10 via-resolve-raised/80 to-resolve-raised/60 resolve-card-glow-accent",
        variant === "flat" && "border border-resolve-border bg-resolve-raised/60",
        padding && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
