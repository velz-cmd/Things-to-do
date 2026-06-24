import clsx from "clsx";

export function Panel({
  children,
  className,
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-resolve-border-strong bg-resolve-raised",
        padding && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
