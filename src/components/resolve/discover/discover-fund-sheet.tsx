"use client";

import Link from "next/link";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { FundSheetRequest, WalletSnapshot } from "@/lib/discover/discover-action-engine";
import { Button } from "@/components/resolve/ui/button";

type DiscoverFundSheetProps = {
  open: boolean;
  request: FundSheetRequest | null;
  wallet: WalletSnapshot;
  busy: boolean;
  onClose: () => void;
  onConfirm: (amountUsd: number) => void;
};

export function DiscoverFundSheet({
  open,
  request,
  wallet,
  busy,
  onClose,
  onConfirm,
}: DiscoverFundSheetProps) {
  if (!open || !request) return null;

  const defaultAmount = request.amountUsd && request.amountUsd >= 5 ? String(request.amountUsd) : "25";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discover-fund-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f18] p-5 shadow-2xl"
      >
        <p id="discover-fund-title" className="text-sm font-semibold text-white">
          {request.label ?? "Fund program"}
        </p>
        <p className="mt-1 text-xs text-resolve-muted">
          {request.programId
            ? "Fulfill obligations from your Arc wallet"
            : request.communitySlug
              ? `Install + create program on ${request.communitySlug} if needed, then fund`
              : "Resolve program and fund"}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-resolve-muted">
          <div className="flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-resolve-accent" />
            {wallet.loaded ? (
              <span>
                Spendable:{" "}
                <span className="font-medium tabular-nums text-white">
                  ${wallet.spendableUsd.toFixed(2)}
                </span>
              </span>
            ) : (
              <span>Loading wallet…</span>
            )}
          </div>
          <Link
            href="/capital"
            className="text-[11px] font-medium text-resolve-accent hover:underline"
          >
            Add funds / sync wallet →
          </Link>
        </div>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const amountUsd = Number(fd.get("amountUsd"));
            if (!Number.isFinite(amountUsd) || amountUsd < 5) {
              toast.error("Amount can't be less than $5");
              return;
            }
            onConfirm(amountUsd);
          }}
        >
          <label className="text-[11px] text-resolve-muted" htmlFor="fund-amount">
            Amount (USD)
          </label>
          <p className="mt-0.5 text-[10px] text-resolve-muted-dim">Minimum fund is $5 USDC</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-resolve-muted">$</span>
            <input
              id="fund-amount"
              name="amountUsd"
              type="number"
              min={5}
              step={5}
              defaultValue={defaultAmount}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm fund"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
