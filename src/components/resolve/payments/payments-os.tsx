"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { FxSwapPanel } from "@/components/wallet/fx-swap-panel";
import { CapitalCommunityPrograms } from "@/components/resolve/capital/capital-community-programs";
import { CapitalSettlementRow } from "@/components/resolve/capital/settlement-truth";
import type { FxSwapHint, PayoutCurrency } from "@/lib/settlement/fx";

type Overview = {
  treasury: {
    balanceUsd: number;
    obligationsUsd?: number;
    availableUsd?: number;
    liveArc: boolean;
    canDistributeOnChain: boolean;
    canSettleGlobally?: boolean;
    message: string;
    totalDistributedUsd: number;
    batchCount: number;
  };
  ledger: {
    authorizedUsd: number;
    pendingFundingUsd: number;
    claimableUsd: number;
    settledUsd: number;
    count: number;
  };
  recentAuthorizations: {
    id: string;
    connectorId: string;
    missionId: string;
    payeeKey: string;
    amountUsd: number;
    status: string;
    contextLabel: string | null;
    updatedAt: string;
  }[];
  settlements: {
    id: string;
    missionId: string;
    repo: string | null;
    status: string;
    treasuryAmount: number;
    createdAt: string;
    escrowTxHash: string | null;
  }[];
};

type RewardSummary = {
  claimableUsd: number;
  authorizedUsd?: number;
  settledUsd: number;
};

export function PaymentsOS() {
  const { user, signInWithGitHub, githubEnabled } = useAuth();
  const { openSignIn } = useSignInModal();
  const capabilities = useAuthCapabilities();
  const githubOAuthReady = capabilities.loaded && capabilities.github;
  const { open: openWallet } = useAppKit();
  const { address, isConnected } = useAccount();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [claimSummary, setClaimSummary] = useState<RewardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [fxHint, setFxHint] = useState<FxSwapHint | null>(null);
  const [payoutCurrency, setPayoutCurrency] = useState<PayoutCurrency>("USDC");
  const [currencyOptions, setCurrencyOptions] = useState<
    { id: PayoutCurrency; label: string }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ovRes = await fetch("/api/payments/overview");
      if (!ovRes.ok) throw new Error("overview failed");
      const ov = await ovRes.json();
      setOverview(ov);

      const rewardsRes = await fetch("/api/rewards", { credentials: "include" });
      if (rewardsRes.ok) {
        const rewards = await rewardsRes.json();
        setClaimSummary(rewards.summary ?? null);
      } else {
        setClaimSummary({ claimableUsd: 0, settledUsd: 0 });
      }
    } catch {
      toast.error("Could not load treasury");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load, user]);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/profile/payout-preference", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.currency) setPayoutCurrency(data.currency);
        if (data.options) setCurrencyOptions(data.options);
      })
      .catch(() => {
        /* optional */
      });
  }, [user]);

  async function handleClaim() {
    if (!isConnected || !address) {
      openWallet({ view: "Connect" });
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      if (data.fxHint) setFxHint(data.fxHint);
      toast.success("Authorizations claimed");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  const treasury = overview?.treasury;
  const ledger = overview?.ledger;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-8">
      <header className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Capital
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Where should money move?</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          Treasury · Pending · Claims · History — real USDC, no invoice flow.
        </p>
      </header>

      <section className="border-b border-resolve-border pb-8">
        <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
          Treasury
        </p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-white">
          <Money amount={treasury?.balanceUsd ?? 0} size="lg" />
        </p>
        <p className="mt-2 text-sm text-resolve-muted">{treasury?.message ?? "Loading…"}</p>
        {(treasury?.obligationsUsd ?? 0) > 0 && (
          <p className="mt-1 text-xs text-amber-200/90">
            Obligations ${(treasury?.obligationsUsd ?? 0).toFixed(2)} · Available $
            {(treasury?.availableUsd ?? 0).toFixed(2)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-6 text-sm text-resolve-muted">
          <span>
            Authorized: <Money amount={ledger?.authorizedUsd ?? 0} size="sm" className="inline" />
          </span>
          <span>
            Claimable: <Money amount={ledger?.claimableUsd ?? 0} size="sm" className="inline" />
          </span>
          <span>
            Settled: <Money amount={ledger?.settledUsd ?? 0} size="sm" className="inline" />
          </span>
        </div>
      </section>

      <section className="border-b border-resolve-border py-8">
        <CapitalCommunityPrograms />
      </section>

      <section className="border-b border-resolve-border py-8">
        <p className="text-sm font-semibold text-white">Pending</p>
        <p className="mt-3 text-sm text-resolve-muted">
          Authorized:{" "}
          <Money amount={ledger?.authorizedUsd ?? 0} size="sm" className="inline" />
          {" · "}
          Awaiting funding:{" "}
          <Money amount={ledger?.pendingFundingUsd ?? 0} size="sm" className="inline" />
        </p>
      </section>

      <section className="border-b border-resolve-border py-8">
        <p className="text-sm font-semibold text-white">Claims</p>
        {!user ?
          <div className="mt-4 space-y-3">
            <p className="text-sm text-resolve-muted">Sign in to collect authorized earnings.</p>
            <Button
              onClick={() =>
                githubOAuthReady && githubEnabled ? signInWithGitHub() : openSignIn()
              }
            >
              Sign in
            </Button>
          </div>
        : <>
            <p className="mt-3 text-lg font-medium text-white">
              <Money amount={claimSummary?.claimableUsd ?? 0} size="sm" className="inline" />{" "}
              claimable
            </p>
            {currencyOptions.length > 0 && (
              <select
                value={payoutCurrency}
                onChange={(e) => {
                  const next = e.target.value as PayoutCurrency;
                  setPayoutCurrency(next);
                  void fetch("/api/profile/payout-preference", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ currency: next }),
                  });
                }}
                className="mt-3 block w-full max-w-xs rounded-lg border border-resolve-border bg-resolve-bg px-3 py-2 text-sm text-white"
              >
                {currencyOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {fxHint && (
              <div className="mt-4">
                <FxSwapPanel hint={fxHint} />
              </div>
            )}
            <div className="mt-4">
              {!isConnected ?
                <Button onClick={() => openWallet({ view: "Connect" })}>Connect wallet</Button>
              : <Button
                  onClick={() => void handleClaim()}
                  disabled={claiming || (claimSummary?.claimableUsd ?? 0) <= 0}
                >
                  {claiming ? "Claiming…" : "Claim all"}
                </Button>
              }
            </div>
          </>
        }
      </section>

      <section className="py-8">
        <p className="text-sm font-semibold text-white">History</p>
        <p className="mt-1 text-xs text-resolve-muted">
          Settlements show explorer verification — never optimistic paid state.
        </p>
        {loading ?
          <p className="mt-3 text-sm text-resolve-muted">Loading…</p>
        : !overview?.settlements.length && !overview?.recentAuthorizations.length ?
          <p className="mt-3 text-sm text-resolve-muted">No settlements yet.</p>
        : <ul className="mt-4">
            {overview?.settlements.map((s) => (
              <CapitalSettlementRow
                key={s.id}
                label={s.repo ?? s.missionId}
                amountUsd={s.treasuryAmount}
                txHash={s.escrowTxHash}
                status={s.status}
                at={s.createdAt}
              />
            ))}
            {overview?.recentAuthorizations.slice(0, 8).map((a) => (
              <CapitalSettlementRow
                key={a.id}
                label={a.contextLabel ?? a.missionId}
                amountUsd={a.amountUsd}
                txHash={null}
                status={a.status}
                at={a.updatedAt}
              />
            ))}
          </ul>
        }
      </section>
    </div>
  );
}
