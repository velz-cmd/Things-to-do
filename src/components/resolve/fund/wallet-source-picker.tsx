"use client";

import clsx from "clsx";
import type { FundingSource } from "@/lib/wallet/funding-source";
import { fundingSourceLabel } from "@/lib/wallet/funding-source";

type WalletSourcePickerProps = {
  appUsd: number;
  extUsd: number;
  amountUsd: number;
  externalReady: boolean;
  /** Linked in Profile/API even if wagmi session is disconnected */
  hasLinkedExternal: boolean;
  value: FundingSource | null;
  onChange: (source: FundingSource) => void;
  disabled?: boolean;
  onReconnectExternal?: () => void;
};

export function WalletSourcePicker({
  appUsd,
  extUsd,
  amountUsd,
  externalReady,
  hasLinkedExternal,
  value,
  onChange,
  disabled,
  onReconnectExternal,
}: WalletSourcePickerProps) {
  const showExternal = hasLinkedExternal || externalReady;
  if (!showExternal) return null;

  const options: Array<{
    id: FundingSource;
    balance: number;
    canPay: boolean;
    hint?: string;
  }> = [
    {
      id: "app",
      balance: appUsd,
      canPay: appUsd >= amountUsd,
      hint: "Circle wallet on Arc",
    },
    {
      id: "external",
      balance: extUsd,
      canPay: externalReady && extUsd >= amountUsd,
      hint: externalReady
        ? "Wallet signature on Arc"
        : "Reconnect to sign on Arc",
    },
  ];

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
        Pay from — tap to choose
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const selected = value === opt.id;
          const needsReconnect = opt.id === "external" && !externalReady;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (needsReconnect) {
                  onReconnectExternal?.();
                }
                onChange(opt.id);
              }}
              className={clsx(
                "rounded-lg border px-3 py-2.5 text-left text-xs transition",
                selected
                  ? "border-resolve-accent bg-resolve-accent/15 text-white ring-1 ring-resolve-accent/30"
                  : "border-white/10 bg-black/20 text-resolve-muted hover:border-white/25 hover:text-white",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <span className="font-medium text-white">{fundingSourceLabel(opt.id)}</span>
              <span className="mt-0.5 block tabular-nums text-[11px] text-resolve-muted">
                ${opt.balance.toFixed(2)} on Arc
              </span>
              {opt.hint && (
                <span
                  className={clsx(
                    "mt-1 block text-[10px]",
                    needsReconnect ? "text-amber-200/90" : "text-resolve-muted-dim",
                  )}
                >
                  {needsReconnect ? opt.hint : opt.canPay ? opt.hint : "Insufficient for this amount"}
                </span>
              )}
              {selected && (
                <span className="mt-1 block text-[10px] font-medium text-resolve-accent">
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
