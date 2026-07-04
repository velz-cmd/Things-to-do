"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { FundSheetRequest, WalletSnapshot } from "@/lib/discover/discover-action-engine";
import { Button } from "@/components/resolve/ui/button";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";

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
  const { state: connections } = useUserConnections();

  const defaultAmount =
    request?.amountUsd && request.amountUsd >= 5 ? request.amountUsd.toFixed(2) : "25";
  const [amount, setAmount] = useState(defaultAmount);
  const amountUsd = Number(amount);
  const insufficientBalance =
    wallet.loaded && Number.isFinite(amountUsd) && amountUsd > wallet.spendableUsd;
  const canUseBalance = wallet.loaded && wallet.spendableUsd >= 5;

  useEffect(() => {
    setAmount(defaultAmount);
  }, [defaultAmount, request?.programId, request?.communitySlug]);

  if (!open || !request) return null;

  const slug = request.communitySlug;
  const communityReady = slug ? communityReadyForDiscover(slug, connections) : false;
  const fundHint = request.programId
    ? "USDC moves from your wallet into this pool"
    : communityReady && slug
      ? `Adds USDC to the ${slug} pool on Arc`
      : slug
        ? `Creates the pool and funds it in one step`
        : "Fund this program";

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
        <p className="mt-1 text-xs text-resolve-muted">{fundHint}</p>
        <div className="mt-3 grid gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] text-resolve-muted sm:grid-cols-2">
          <span>
            Network: <span className="font-medium text-white">Arc Testnet USDC</span>
          </span>
          <span>
            Fee estimate: <span className="font-medium text-white">shown before settlement</span>
          </span>
        </div>

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
              <span>Loading wallet...</span>
            )}
          </div>
          <Link
            href="/capital?returnUrl=/discover"
            className="text-[11px] font-medium text-resolve-accent hover:underline"
          >
            Add funds / sync wallet
          </Link>
        </div>
        {insufficientBalance && (
          <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">
            You have ${wallet.spendableUsd.toFixed(2)} spendable. Add funds or lower the amount.
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/capital?returnUrl=/discover"
                className="font-medium text-resolve-accent hover:underline"
              >
                Add funds
              </Link>
              {canUseBalance && (
                <button
                  type="button"
                  onClick={() => setAmount(wallet.spendableUsd.toFixed(2))}
                  className="font-medium text-resolve-accent hover:underline"
                >
                  Use ${wallet.spendableUsd.toFixed(2)}
                </button>
              )}
            </div>
          </div>
        )}
        {busy && (
          <ol className="mt-3 space-y-1 rounded-lg border border-resolve-accent/20 bg-resolve-accent/[0.05] px-3 py-2 text-[11px] text-resolve-muted">
            <li className="text-emerald-300">Wallet checked</li>
            <li className="text-emerald-300">Funding request sent</li>
            <li className="flex items-center gap-1.5 text-resolve-accent">
              <Loader2 className="h-3 w-3 animate-spin" />
              Waiting for Arc or ledger confirmation
            </li>
          </ol>
        )}

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number.isFinite(amountUsd) || amountUsd < 5) {
              toast.error("Amount can't be less than $5");
              return;
            }
            if (insufficientBalance) {
              toast.error("Add funds or lower the amount", {
                description: `You have $${wallet.spendableUsd.toFixed(2)} spendable.`,
              });
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
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.currentTarget.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || insufficientBalance}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm fund"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
