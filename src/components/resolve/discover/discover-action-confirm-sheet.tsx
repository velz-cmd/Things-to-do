"use client";

import { Loader2 } from "lucide-react";
import type { DiscoverAction } from "@/lib/discover/types";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import type { WalletSnapshot } from "@/lib/discover/discover-action-engine";
import { discoverActionSummary, discoverActionNextHint } from "@/lib/discover/discover-action-copy";
import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";
import { Button } from "@/components/resolve/ui/button";

type DiscoverActionConfirmSheetProps = {
  open: boolean;
  action: DiscoverAction | null;
  connections: UserConnectionState | null | undefined;
  wallet: WalletSnapshot;
  busy: boolean;
  amountUsd?: number;
  onClose: () => void;
  onConfirm: () => void;
};

/** One-sentence confirm before a real Discover action runs. */
export function DiscoverActionConfirmSheet({
  open,
  action,
  connections,
  wallet,
  busy,
  amountUsd,
  onClose,
  onConfirm,
}: DiscoverActionConfirmSheetProps) {
  if (!open || !action) return null;

  const label = friendlyDiscoverActionLabel(action, connections);
  const { headline, requirement } = discoverActionSummary(
    action,
    connections,
    wallet.loaded ? wallet.spendableUsd : null,
  );

  const nextHint = discoverActionNextHint(action);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f18] p-5 shadow-2xl"
      >
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{headline}</p>

        {requirement && (
          <p className="mt-2 text-[11px] font-medium text-amber-200/90">{requirement}</p>
        )}

        {nextHint && (
          <p className="mt-2 text-[11px] text-resolve-accent/90">{nextHint}</p>
        )}

        {(action.kind === "fund" || action.kind === "sponsor") && wallet.loaded && (
          <p className="mt-3 text-[11px] text-resolve-muted">
            Spendable:{" "}
            <span className="font-medium tabular-nums text-white">
              ${wallet.spendableUsd.toFixed(2)}
            </span>
            {amountUsd != null && amountUsd >= 5 && (
              <>
                {" "}
                · funding{" "}
                <span className="font-medium text-emerald-200">${amountUsd.toFixed(2)}</span>
              </>
            )}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={busy || Boolean(requirement)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
