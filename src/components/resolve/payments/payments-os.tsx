"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CreditCard, Landmark, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { MetricCard } from "@/components/resolve/ui/metric-card";
import { SectionHeader } from "@/components/resolve/ui/section-header";
import { Button } from "@/components/resolve/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { explorerUrlForTx, isOnChainTxHash } from "@/lib/payment/tx-utils";
import { FxSwapPanel } from "@/components/wallet/fx-swap-panel";
import { ProductPage } from "@/components/resolve/layout/product-page";
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

function statusTone(status: string) {
  if (status === "settled" || status === "SETTLED") return "text-emerald-300";
  if (status === "claimable" || status === "pending_funding") return "text-amber-300";
  if (status === "authorized") return "text-sky-300";
  return "text-resolve-muted";
}

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
    <ProductPage
      icon={CreditCard}
      title="Payments"
      description="Treasury, authorizations, fulfillment, and claims — Stripe-grade money movement for open ecosystems."
      workflows={[
        { label: "Treasury", active: true },
        { label: "Authorizations" },
        { label: "Claims" },
        { label: "Settlement" },
      ]}
      width="narrow"
      accent="emerald"
    >
      <div className="space-y-10">
        <section>
          <SectionHeader title="Treasury" description="Global settlement pool" icon={Landmark} />
          <Panel variant="glow" className="mt-4 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tabular-nums text-white">
                  <Money amount={treasury?.balanceUsd ?? 0} size="lg" />
                </p>
                <p className="mt-2 text-sm text-resolve-muted">
                  {treasury?.message ?? "Loading treasury…"}
                </p>
                {(treasury?.obligationsUsd ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-amber-200/90">
                    Obligations: ${(treasury?.obligationsUsd ?? 0).toFixed(2)} · Available: $
                    {(treasury?.availableUsd ?? 0).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="text-right text-sm text-resolve-muted">
                <p>
                  Distributed:{" "}
                  <Money amount={treasury?.totalDistributedUsd ?? 0} size="sm" className="inline" />
                </p>
                <p>{treasury?.batchCount ?? 0} settlement batches</p>
              </div>
            </div>
            <Link
              href="/workspace/fund"
              className="mt-5 inline-block text-sm font-medium text-resolve-accent hover:underline"
            >
              Fund a project →
            </Link>
          </Panel>
        </section>

        <section>
          <SectionHeader title="Authorization queue" icon={Receipt} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Authorized"
              value={<Money amount={ledger?.authorizedUsd ?? 0} size="sm" />}
              tone="accent"
              live
            />
            <MetricCard
              label="Pending funding"
              value={<Money amount={ledger?.pendingFundingUsd ?? 0} size="sm" />}
              tone="warning"
            />
            <MetricCard
              label="Claimable"
              value={<Money amount={ledger?.claimableUsd ?? 0} size="sm" />}
              tone="success"
            />
            <MetricCard
              label="Settled"
              value={<Money amount={ledger?.settledUsd ?? 0} size="sm" />}
              tone="violet"
            />
          </div>
          <Panel variant="glass" className="mt-4 p-5">
            <p className="text-sm font-semibold text-white">Recent authorizations</p>
            {loading ?
              <p className="mt-3 text-sm text-resolve-muted">Loading…</p>
            : !overview?.recentAuthorizations.length ?
              <p className="mt-3 text-sm text-resolve-muted">
                No authorizations yet. Fund a project or connect a source.
              </p>
            : <ul className="mt-4 divide-y divide-resolve-border/60">
                {overview.recentAuthorizations.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-white">{a.contextLabel ?? a.missionId}</p>
                      <p className="text-xs text-resolve-muted">
                        {a.connectorId} · @{a.payeeKey}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money amount={a.amountUsd} size="sm" />
                      <p className={clsx("text-[10px] font-medium uppercase", statusTone(a.status))}>
                        {a.status.replace("_", " ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            }
          </Panel>
        </section>

        <section>
          <SectionHeader title="Claims" description="Collect your authorized earnings" icon={Wallet} />
          <Panel variant="glass" className="mt-4 p-6">
            {!user ?
              <div className="space-y-4">
                <p className="text-sm text-resolve-muted">
                  Sign in with GitHub to claim your authorizations.
                </p>
                <Button
                  onClick={() =>
                    githubOAuthReady && githubEnabled ? signInWithGitHub() : openSignIn()
                  }
                >
                  Sign in with GitHub
                </Button>
              </div>
            : <>
                <p className="text-lg font-semibold text-white">
                  Claimable:{" "}
                  <Money amount={claimSummary?.claimableUsd ?? 0} size="sm" className="inline" />
                </p>
                {currencyOptions.length > 0 && (
                  <div className="mt-4">
                    <label className="text-xs font-medium text-resolve-muted">
                      Receive as (after claim)
                    </label>
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
                      className="mt-2 block w-full max-w-xs rounded-resolve border border-resolve-border-strong bg-resolve-bg px-3 py-2.5 text-sm text-white"
                    >
                      {currencyOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-[11px] text-resolve-muted-dim">
                      Settlement is USDC on Arc — swap to EURC or cirBTC in your wallet when ready.
                    </p>
                  </div>
                )}
                {fxHint && (
                  <div className="mt-4">
                    <FxSwapPanel hint={fxHint} />
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {!isConnected ?
                    <Button onClick={() => openWallet({ view: "Connect" })}>
                      Connect wallet to claim
                    </Button>
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
          </Panel>
        </section>

        <section>
          <SectionHeader title="Settlement history" />
          <Panel variant="glass" className="mt-4 p-5">
            {loading ?
              <p className="text-sm text-resolve-muted">Loading…</p>
            : !overview?.settlements.length ?
              <p className="text-sm text-resolve-muted">
                No settlements yet. Fulfill authorizations when treasury is ready.
              </p>
            : <ul className="divide-y divide-resolve-border/60">
                {overview.settlements.map((s) => {
                  const tx = s.escrowTxHash;
                  const onChain = tx && isOnChainTxHash(tx);
                  const explorer = onChain ? explorerUrlForTx(tx) : null;
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-white">{s.repo ?? s.missionId}</p>
                        <p className="text-xs text-resolve-muted">
                          {new Date(s.createdAt).toLocaleString()} ·{" "}
                          <span className={statusTone(s.status)}>{s.status}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <Money amount={s.treasuryAmount} size="sm" />
                        {explorer && (
                          <a
                            href={explorer}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block text-[11px] font-medium text-resolve-accent hover:underline"
                          >
                            View transaction
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            }
          </Panel>
        </section>
      </div>
    </ProductPage>
  );
}
