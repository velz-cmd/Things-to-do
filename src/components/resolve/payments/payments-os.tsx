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
      const [ovRes, rewardsRes] = await Promise.all([
        fetch("/api/payments/overview"),
        fetch("/api/rewards", { credentials: "include" }),
      ]);
      const ov = await ovRes.json();
      const rewards = await rewardsRes.json();
      setOverview(ov);
      setClaimSummary(rewards.summary ?? null);
    } catch {
      toast.error("Could not load payments");
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
        <h1 className="mt-2 text-2xl font-semibold text-white">Treasury & settlement</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          How much capital you manage — claims, queue, history.
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
        {loading ?
          <p className="mt-3 text-sm text-resolve-muted">Loading…</p>
        : !overview?.settlements.length && !overview?.recentAuthorizations.length ?
          <p className="mt-3 text-sm text-resolve-muted">No settlements yet.</p>
        : <ul className="mt-4 divide-y divide-resolve-border/60">
            {overview?.recentAuthorizations.slice(0, 8).map((a) => (
              <li key={a.id} className="flex justify-between gap-2 py-3 text-sm">
                <span className="text-resolve-muted">{a.contextLabel ?? a.missionId}</span>
                <span>
                  <Money amount={a.amountUsd} size="sm" className="inline" />
                </span>
              </li>
            ))}
            {overview?.settlements.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 py-3 text-sm">
                <span className="text-resolve-muted">{s.repo ?? s.missionId}</span>
                <Money amount={s.treasuryAmount} size="sm" />
              </li>
            ))}
          </ul>
        }
      </section>
    </div>
  );
}
