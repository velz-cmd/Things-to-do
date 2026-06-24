import clsx from "clsx";

export function Money({
  amount,
  currency = "USD",
  className,
  size = "md",
}: {
  amount: number;
  currency?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <span
      className={clsx(
        "font-semibold tabular-nums tracking-tight text-white",
        sizes[size],
        className
      )}
    >
      ${amount.toFixed(2)}
      {currency !== "USD" && (
        <span className="ml-1 text-sm font-normal text-resolve-muted">{currency}</span>
      )}
    </span>
  );
}

export function MonoHash({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const short =
    value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-6)}`
      : value;
  return (
    <span className={clsx("font-mono text-xs text-resolve-muted", className)}>
      {short}
    </span>
  );
}
