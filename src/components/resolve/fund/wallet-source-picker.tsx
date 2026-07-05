"use client";

import clsx from "clsx";
import type { FundingSource } from "@/lib/wallet/funding-source";
import { fundingSourceLabel } from "@/lib/wallet/funding-source";

type WalletSourcePickerProps = {
  appUsd: number;
  extUsd: number;
  amountUsd: number;
  externalReady: boolean;
  value: FundingSource | null;
  onChange: (source: FundingSource) => void;
  disabled?: boolean;
};

export function WalletSourcePicker({
  appUsd,
  extUsd,
  amountUsd,
  externalReady,
  value,
  onChange,
  disabled,
}: WalletSourcePickerProps) {
  const appOk = appUsd >= amountUsd;
  const extOk = externalReady && extUsd >= amountUsd;

  if (!appOk && !extOk) return null;
  if (appOk && !extOk) return null;
  if (!appOk && extOk) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
        Pay from
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            { id: "external" as const, ok: extOk, balance: extUsd },
            { id: "app" as const, ok: appOk, balance: appUsd },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled || !opt.ok}
            onClick={() => onChange(opt.id)}
            className={clsx(
              "rounded-lg border px-3 py-2.5 text-left text-xs transition",
              value === opt.id
                ? "border-resolve-accent bg-resolve-accent/15 text-white"
                : "border-white/10 bg-black/20 text-resolve-muted hover:border-white/20",
              (!opt.ok || disabled) && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="font-medium text-white">{fundingSourceLabel(opt.id)}</span>
            <span className="mt-0.5 block tabular-nums text-[11px] text-resolve-muted">
              ${opt.balance.toFixed(2)} available
            </span>
            {opt.id === "external" && (
              <span className="mt-1 block text-[10px] text-resolve-muted-dim">
                Wallet signature on Arc
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
