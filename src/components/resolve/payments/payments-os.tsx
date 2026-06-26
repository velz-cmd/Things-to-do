"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { explorerUrlForTx, isOnChainTxHash } from "@/lib/payment/tx-utils";
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
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Payments</h1>
        <p className="mt-1 text-sm text-resolve-muted">
          Treasury, authorizations, fulfillment, and claims — one financial operating system.
        </p>
      </div>

      {/* Treasury */}
      <section>
        <SectionLabel>Treasury</SectionLabel>
        <Panel className="mt-3 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold text-white">
                <Money amount={treasury?.balanceUsd ?? 0} size="lg" />
              </p>
              <p className="mt-1 text-xs text-resolve-muted">
                {treasury?.message ?? "Loading treasury…"}
              </p>
              {(treasury?.obligationsUsd ?? 0) > 0 && (
                <p className="mt-2 text-xs text-amber-200/90">
                  Obligations: ${(treasury?.obligationsUsd ?? 0).toFixed(2)} · Available:{" "}
                  ${(treasury?.availableUsd ?? 0).toFixed(2)}
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
            href="/workspace"
            className="mt-4 inline-block text-sm text-resolve-accent hover:underline"
          >
            Authorize value in Workspace →
          </Link>
        </Panel>
      </section>

      {/* Authorization queue */}
      <section>
        <SectionLabel>Authorization queue</SectionLabel>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QueueCard label="Authorized" amount={ledger?.authorizedUsd ?? 0} tone="sky" live />
          <QueueCard label="Pending funding" amount={ledger?.pendingFundingUsd ?? 0} tone="amber" />
          <QueueCard label="Claimable" amount={ledger?.claimableUsd ?? 0} tone="emerald" />
          <QueueCard label="Settled" amount={ledger?.settledUsd ?? 0} tone="muted" />
        </div>
        <Panel className="mt-3 p-4">
          <p className="text-sm font-medium text-white">Recent authorizations</p>
          {loading ?
            <p className="mt-2 text-sm text-resolve-muted">Loading…</p>
          : !overview?.recentAuthorizations.length ?
            <p className="mt-2 text-sm text-resolve-muted">
              No authorizations yet. Analyze a repository or connect a source.
            </p>
          : <ul className="mt-3 divide-y divide-resolve-border">
              {overview.recentAuthorizations.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="text-white">{a.contextLabel ?? a.missionId}</p>
                    <p className="text-xs text-resolve-muted">
                      {a.connectorId} · @{a.payeeKey}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money amount={a.amountUsd} size="sm" />
                    <p className={clsx("text-[10px] uppercase", statusTone(a.status))}>
                      {a.status.replace("_", " ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          }
        </Panel>
      </section>

      {/* Claims */}
      <section>
        <SectionLabel>Claims</SectionLabel>
        <Panel className="mt-3 p-5">
          {!user ?
            <div className="space-y-3">
              <p className="text-sm text-resolve-muted">
                Sign in with GitHub to claim your authorizations.
              </p>
              <button
                type="button"
                onClick={() => (githubOAuthReady && githubEnabled ? signInWithGitHub() : openSignIn())}
                className="rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in with GitHub
              </button>
            </div>
          : <>
              <p className="text-sm text-white">
                Claimable:{" "}
                <Money amount={claimSummary?.claimableUsd ?? 0} size="sm" className="inline" />
              </p>
              {currencyOptions.length > 0 && (
                <div className="mt-3">
                  <label className="text-xs text-resolve-muted">Receive as (after claim)</label>
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
                    className="mt-1 block w-full max-w-xs rounded-md border border-resolve-border bg-resolve-bg px-3 py-2 text-sm text-white"
                  >
                    {currencyOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-resolve-muted-dim">
                    Settlement is USDC on Arc — swap to EURC or cirBTC in your wallet when ready.
                  </p>
                </div>
              )}
              {fxHint && <div className="mt-4"><FxSwapPanel hint={fxHint} /></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                {!isConnected ?
                  <button
                    type="button"
                    onClick={() => openWallet({ view: "Connect" })}
                    className="rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white"
                  >
                    Connect wallet to claim
                  </button>
                : <button
                    type="button"
                    onClick={() => void handleClaim()}
                    disabled={claiming || (claimSummary?.claimableUsd ?? 0) <= 0}
                    className="rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {claiming ? "Claiming…" : "Claim all"}
                  </button>
                }
              </div>
            </>
          }
        </Panel>
      </section>

      {/* Settlement history */}
      <section>
        <SectionLabel>Settlement history</SectionLabel>
        <Panel className="mt-3 p-4">
          {loading ?
            <p className="text-sm text-resolve-muted">Loading…</p>
          : !overview?.settlements.length ?
            <p className="text-sm text-resolve-muted">
              No settlements yet. Fulfill authorizations from Workspace when treasury is ready.
            </p>
          : <ul className="divide-y divide-resolve-border">
              {overview.settlements.map((s) => {
                const tx = s.escrowTxHash;
                const onChain = tx && isOnChainTxHash(tx);
                const explorer = onChain ? explorerUrlForTx(tx) : null;
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
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
                          className="mt-0.5 block text-[10px] text-resolve-accent hover:underline"
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
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
      {children}
    </h2>
  );
}

function QueueCard({
  label,
  amount,
  tone,
  live,
}: {
  label: string;
  amount: number;
  tone: "sky" | "amber" | "emerald" | "muted";
  live?: boolean;
}) {
  const border =
    tone === "sky" ? "border-sky-500/20"
    : tone === "amber" ? "border-amber-500/20"
    : tone === "emerald" ? "border-emerald-500/20"
    : "border-resolve-border";

  return (
    <Panel className={clsx("p-4", border)}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-resolve-muted">
        {live && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />}
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-white">
        <Money amount={amount} size="sm" />
      </p>
    </Panel>
  );
}
