import clsx from "clsx";

/**
 * Formats an amount without ever rendering a real payment as zero.
 *
 * Two decimals is right for dollars and wrong for x402 micro-payments: a
 * 0.003 USDC agent charge displayed as "$0.00" tells the user their money
 * vanished. Sub-cent amounts keep enough precision to show what was actually
 * charged; everything else stays at the familiar two decimals.
 */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return "$0.00";
  if (amount === 0) return "$0.00";
  const magnitude = Math.abs(amount);
  if (magnitude >= 0.01) return `$${amount.toFixed(2)}`;
  // Up to 6 decimals covers USDC's smallest practical unit here, with
  // trailing zeros trimmed so 0.003 reads as $0.003, not $0.003000.
  const precise = amount.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return `$${precise}`;
}

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
      {formatMoney(amount)}
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
