"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { useSpendableUsd } from "@/hooks/use-spendable-usd";
import type { FundSheetRequest, WalletSnapshot } from "@/lib/discover/discover-action-engine";
import { Button } from "@/components/resolve/ui/button";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import {
  affordableFundingSources,
  fundingSourceLabel,
  pickFundingSource,
  type FundingSource,
} from "@/lib/wallet/funding-source";
import { FundProgressPanel } from "@/components/resolve/fund/fund-progress-panel";
import { WalletSourcePicker } from "@/components/resolve/fund/wallet-source-picker";
import { DiscoverActionOutcomePanel } from "@/components/resolve/discover/discover-action-outcome-panel";
import { PoolCheckpointPanel } from "@/components/resolve/communities/pool-checkpoint-panel";
import type { FundProgressState } from "@/lib/capital/fund-progress";

type FundOutcomeProps = {
  title: string;
  summary: string;
  steps: import("@/lib/discover/discover-action-outcomes").DiscoverOutcomeStep[];
  amountUsd?: number;
  programName?: string;
  communitySlug?: string;
  programId?: string;
  whoBenefits?: string;
  whyFund?: string;
  onDeployArc?: () => void;
  deployingArc?: boolean;
};

type DiscoverFundSheetProps = {
  open: boolean;
  request: FundSheetRequest | null;
  wallet: WalletSnapshot;
  busy: boolean;
  fundProgress?: FundProgressState;
  fundOutcome?: FundOutcomeProps | null;
  onClose: () => void;
  onConfirm: (amountUsd: number, fundingSource: FundingSource) => void;
};

export function DiscoverFundSheet({
  open,
  request,
  wallet,
  busy,
  fundProgress,
  fundOutcome,
  onClose,
  onConfirm,
}: DiscoverFundSheetProps) {
  const { state: connections } = useUserConnections();
  const spendable = useSpendableUsd();
  const { externalWalletReady, openConnectWallet } = useResolveAccess();

  const defaultAmount =
    request?.amountUsd && request.amountUsd >= 5 ? request.amountUsd.toFixed(2) : "25";
  const [amount, setAmount] = useState(defaultAmount);
  const [chosenWallet, setChosenWallet] = useState<FundingSource | null>(null);
  const amountUsd = Number(amount);

  const appUsd = wallet.appSpendableUsd ?? spendable.appSpendableUsd;
  const extUsd = wallet.externalSpendableUsd ?? spendable.externalSpendableUsd;
  const balances = useMemo(
    () => ({ appSpendableUsd: appUsd, externalSpendableUsd: extUsd }),
    [appUsd, extUsd],
  );

  const affordable = useMemo(
    () =>
      Number.isFinite(amountUsd)
        ? affordableFundingSources(amountUsd, balances, externalWalletReady)
        : [],
    [amountUsd, balances, externalWalletReady],
  );

  const fundingSource = useMemo(() => {
    if (!Number.isFinite(amountUsd) || amountUsd < 5) return null;
    return pickFundingSource(amountUsd, balances, externalWalletReady, chosenWallet);
  }, [amountUsd, balances, externalWalletReady, chosenWallet]);

  useEffect(() => {
    if (affordable.length === 1) {
      setChosenWallet(affordable[0]);
    } else if (chosenWallet) {
      /* keep user selection */
    } else if (affordable.length > 0) {
      setChosenWallet(affordable[0]);
    }
  }, [affordable, chosenWallet]);

  const hasLinkedExternal =
    Boolean(spendable.externalWalletAddress) && !externalWalletReady;
  const insufficientBalance =
    wallet.loaded && Number.isFinite(amountUsd) && !fundingSource && amountUsd >= 5;
  const canUseBalance = wallet.loaded && wallet.spendableUsd >= 5;
  const inProgress = busy && fundProgress && fundProgress.stage !== "idle";
  const isComplete = fundProgress?.stage === "complete" && Boolean(fundOutcome);

  useEffect(() => {
    if (isComplete) {
      document.getElementById("discover-fund-outcome")?.scrollIntoView({ block: "start" });
    }
  }, [isComplete]);

  useEffect(() => {
    setAmount(defaultAmount);
    setChosenWallet(null);
  }, [defaultAmount, request?.programId, request?.communitySlug, open]);

  if (!open || !request) return null;

  const slug = request.communitySlug;
  const communityReady = slug ? communityReadyForDiscover(slug, connections) : false;
  const fundHint = request.programId
    ? "USDC moves into this pool on Arc testnet"
    : communityReady && slug
      ? `Adds USDC to the ${slug} pool on Arc`
      : slug
        ? `Creates the pool and funds it in one step`
        : "Fund this program";

  const progressSource = fundProgress?.fundingSource ?? fundingSource ?? "app";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discover-fund-title"
        className="max-h-[min(90vh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f18] p-5 shadow-2xl"
      >
        {isComplete && fundOutcome ? (
          <div id="discover-fund-outcome">
            <p id="discover-fund-title" className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              Contribution recorded
            </p>
            <DiscoverActionOutcomePanel
              variant="fund"
              title={fundOutcome.title}
              summary={fundOutcome.summary}
              steps={fundOutcome.steps}
              amountUsd={fundOutcome.amountUsd}
              programName={fundOutcome.programName}
              communitySlug={fundOutcome.communitySlug}
              whoBenefits={fundOutcome.whoBenefits}
              whyFund={fundOutcome.whyFund}
              onDeployArc={fundOutcome.onDeployArc}
              deploying={fundOutcome.deployingArc}
              onDone={onClose}
              onClose={onClose}
            />
            {fundOutcome.programId && fundOutcome.communitySlug ? (
              <div className="mt-4">
                <PoolCheckpointPanel
                  communitySlug={fundOutcome.communitySlug}
                  programId={fundOutcome.programId}
                  compact
                />
              </div>
            ) : null}
          </div>
        ) : (
          <>
        <p id="discover-fund-title" className="text-sm font-semibold text-white">
          {request.label ?? "Fund program"}
        </p>
        <p className="mt-1 text-xs text-resolve-muted">{fundHint}</p>
        <div className="mt-3 grid gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] text-resolve-muted sm:grid-cols-2">
          <span>
            Network: <span className="font-medium text-white">Arc Testnet USDC</span>
          </span>
          <span>
            Min: <span className="font-medium text-white">$5 USDC</span>
          </span>
        </div>

        {request.whoBenefits && !inProgress && (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              How your contribution helps
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/90">{request.whoBenefits}</p>
            {request.whyFund && request.whyFund !== request.whoBenefits && (
              <p className="mt-1 text-[11px] text-resolve-muted">{request.whyFund}</p>
            )}
          </div>
        )}

        {inProgress && fundProgress ? (
          <FundProgressPanel
            stage={fundProgress.stage}
            fundingSource={progressSource}
            amountUsd={fundProgress.amountUsd ?? amountUsd}
            txHash={fundProgress.txHash}
          />
        ) : (
          <>
            <div className="mt-4 space-y-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-resolve-muted">
              <div className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-resolve-accent" />
                {wallet.loaded ? (
                  <span className="font-medium text-white">Choose any wallet with USDC</span>
                ) : (
                  <span>Loading wallets…</span>
                )}
              </div>
              {wallet.loaded && (
                <ul className="space-y-1 pl-5 text-[11px]">
                  <li>
                    RESOLVE wallet:{" "}
                    <span className="tabular-nums text-white">${appUsd.toFixed(2)}</span>
                  </li>
                  <li>
                    Your connected wallet:{" "}
                    <span className="tabular-nums text-white">
                      {externalWalletReady ? `$${extUsd.toFixed(2)}` : "not connected"}
                    </span>
                  </li>
                  {hasLinkedExternal && (
                    <li className="text-amber-200">
                      Reconnect from the account menu to sign on Arc
                    </li>
                  )}
                  {fundingSource && Number.isFinite(amountUsd) && amountUsd >= 5 && (
                    <li className="text-emerald-300">
                      Will pay from {fundingSourceLabel(fundingSource)}
                    </li>
                  )}
                </ul>
              )}
            </div>

            <WalletSourcePicker
              appUsd={appUsd}
              extUsd={extUsd}
              amountUsd={amountUsd}
              externalReady={externalWalletReady}
              hasLinkedExternal={Boolean(spendable.externalLinked)}
              value={chosenWallet ?? fundingSource}
              onChange={setChosenWallet}
              disabled={busy}
              onReconnectExternal={openConnectWallet}
            />

            {insufficientBalance && (
              <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">
                Not enough USDC on either wallet for this amount.
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href="/capital?returnUrl=/discover"
                    className="font-medium text-resolve-accent hover:underline"
                  >
                    Add funds in Capital
                  </Link>
                  {!externalWalletReady && (
                    <button
                      type="button"
                      onClick={openConnectWallet}
                      className="font-medium text-resolve-accent hover:underline"
                    >
                      {hasLinkedExternal ? "Reconnect wallet" : "Connect wallet"}
                    </button>
                  )}
                  {canUseBalance && (
                    <button
                      type="button"
                      onClick={() => setAmount(wallet.spendableUsd.toFixed(2))}
                      className="font-medium text-resolve-accent hover:underline"
                    >
                      Use max ${wallet.spendableUsd.toFixed(2)}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {!inProgress && (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!Number.isFinite(amountUsd) || amountUsd < 5) {
                toast.error("Amount can't be less than $5");
                return;
              }
              const source = chosenWallet ?? fundingSource;
              if (!source) {
                toast.error("Pick a wallet with enough USDC");
                return;
              }
              if (source === "external" && !externalWalletReady) {
                toast.message("Reconnect your wallet to sign on Arc");
                openConnectWallet();
                return;
              }
              const affordable = affordableFundingSources(amountUsd, balances, externalWalletReady);
              if (!affordable.includes(source)) {
                toast.error(`Selected wallet cannot cover $${amountUsd.toFixed(2)}`);
                return;
              }
              onConfirm(amountUsd, source);
            }}
          >
            <label className="text-[11px] text-resolve-muted" htmlFor="fund-amount">
              Amount (USD)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-resolve-muted">$</span>
              <input
                id="fund-amount"
                name="amountUsd"
                type="number"
                min={5}
                step="0.01"
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(e.currentTarget.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-50"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy || !fundingSource && !chosenWallet}>
                {(chosenWallet ?? fundingSource) === "external" ? "Confirm in wallet" : "Fund on Arc"}
              </Button>
            </div>
          </form>
        )}
          </>
        )}
      </div>
    </div>
  );
}
