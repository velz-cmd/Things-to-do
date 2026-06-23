"use client";

import { useAddFunds } from "@/components/wallet/add-funds-context";
import clsx from "clsx";

export function DepositPrompt({
  amountUsd,
  message,
  className,
}: {
  amountUsd?: number;
  message?: string;
  className?: string;
}) {
  const { openAddFunds } = useAddFunds();

  return (
    <div
      className={clsx(
        "rounded-lg border border-deputy-warn/40 bg-deputy-warn/10 px-4 py-3",
        className
      )}
    >
      <p className="text-sm text-deputy-warn">
        {message ?? "Add funds to continue this mission."}
      </p>
      <button
        type="button"
        onClick={() => openAddFunds(amountUsd)}
        className="mt-2 text-sm font-semibold text-deputy-accent underline hover:text-white"
      >
        Add funds{amountUsd ? ` ($${amountUsd.toFixed(2)}+)` : ""} →
      </button>
    </div>
  );
}
