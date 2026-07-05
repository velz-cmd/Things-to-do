"use client";

import clsx from "clsx";
import { useActiveWalletView } from "@/hooks/use-active-wallet-view";
import { walletViewLabel, type WalletView } from "@/lib/wallet/active-wallet-view";

type WalletViewSelectorProps = {
  appAddress?: string | null;
  externalAddress?: string | null;
  appUsd?: number | null;
  externalUsd?: number | null;
  compact?: boolean;
  className?: string;
};

export function WalletViewSelector({
  appAddress,
  externalAddress,
  appUsd,
  externalUsd,
  compact,
  className,
}: WalletViewSelectorProps) {
  const { view, setActiveWalletView } = useActiveWalletView();

  const options: Array<{ id: WalletView; disabled: boolean }> = [
    { id: "app", disabled: !appAddress },
    { id: "external", disabled: !externalAddress },
  ];

  if (!appAddress && !externalAddress) return null;
  if (appAddress && !externalAddress) return null;

  return (
    <div className={clsx("space-y-1.5", className)}>
      {!compact && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
          View balance for
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          if (opt.disabled) return null;
          const usd = opt.id === "app" ? appUsd : externalUsd;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setActiveWalletView(opt.id)}
              className={clsx(
                "rounded-lg border px-3 py-2 text-left text-[11px] transition",
                view === opt.id
                  ? "border-resolve-accent bg-resolve-accent/15 text-white"
                  : "border-white/10 bg-black/20 text-resolve-muted hover:border-white/20",
              )}
            >
              <span className="font-medium">{walletViewLabel(opt.id)}</span>
              {usd != null && Number.isFinite(usd) && (
                <span className="mt-0.5 block tabular-nums text-[10px] text-resolve-muted">
                  ${usd.toFixed(2)} on Arc
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
