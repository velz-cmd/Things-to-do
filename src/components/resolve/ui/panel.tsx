import clsx from "clsx";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";

type PanelVariant = "default" | "glass" | "glow" | "accent" | "flat" | "orange";

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
  if (variant === "glass" || variant === "glow") {
    return (
      <BlueGlowCard
        variant="blue"
        hover={hover}
        grid={variant === "glow"}
        padding={padding}
        className={className}
      >
        {children}
      </BlueGlowCard>
    );
  }

  if (variant === "orange") {
    return (
      <BlueGlowCard variant="orange" hover={hover} grid={false} padding={padding} className={className}>
        {children}
      </BlueGlowCard>
    );
  }

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-resolve-lg",
        variant === "default" && "border border-resolve-border-strong bg-resolve-raised resolve-blue-glow",
        variant === "accent" &&
          "resolve-glass border border-resolve-accent/25 shadow-resolve-blue",
        variant === "flat" && "border border-resolve-border bg-resolve-raised/50",
        hover && "resolve-card-hover",
        padding && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
