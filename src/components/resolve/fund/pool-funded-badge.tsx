"use client";

import clsx from "clsx";
import { BadgeCheck } from "lucide-react";

type PoolFundedBadgeProps = {
  amountUsd: number;
  compact?: boolean;
  className?: string;
};

export function PoolFundedBadge({ amountUsd, compact, className }: PoolFundedBadgeProps) {
  if (amountUsd < 5) return null;
  const label =
    amountUsd >= 100
      ? `You funded $${Math.round(amountUsd)}+`
      : `You funded $${amountUsd.toFixed(amountUsd % 1 === 0 ? 0 : 2)}`;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 font-medium text-emerald-100",
        compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]",
        className,
      )}
      title="Your Arc testnet USDC contribution to this pool"
    >
      <BadgeCheck className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {label}
    </span>
  );
}
