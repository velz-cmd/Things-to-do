import clsx from "clsx";

export function GlassPanel({
  children,
  className,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl",
        glow && "shadow-[0_0_60px_-12px_rgba(56,189,248,0.25)]",
        className
      )}
    >
      {children}
    </div>
  );
}
