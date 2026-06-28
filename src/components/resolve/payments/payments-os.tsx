"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { FxSwapPanel } from "@/components/wallet/fx-swap-panel";
import { CapitalCommunityPrograms } from "@/components/resolve/capital/capital-community-programs";
import { CapitalSettlementRow } from "@/components/resolve/capital/settlement-truth";
import { CurrencySelect } from "@/components/resolve/capital/currency-select";
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
    fundingWallet: string | null;
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

type UserBalance = {
  availableUsd: number;
  lockedUsd: number;
  authenticated: boolean;
};

type Earnings = {
  claimableUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  githubLinked: boolean;
};

export function PaymentsOS() {
  const { user, signInWithGitHub, githubEnabled } = useAuth();
  const { openSignIn } = useSignInModal();
  const capabilities = useAuthCapabilities();
  const account = useResolveAccount();
  const githubOAuthReady = capabilities.loaded && capabilities.github;

  const [overview, setOverview] = useState<Overview | null>(null);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [fxHint, setFxHint] = useState<FxSwapHint | null>(null);
  const [payoutCurrency, setPayoutCurrency] = useState<PayoutCurrency>("USDC");
  const [currencyOptions, setCurrencyOptions] = useState<
    { id: PayoutCurrency; label: string }[]
  >([]);

  const payoutWallet =
    account.appWalletAddress ?? account.walletAddress ?? account.externalWalletAddress;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true);
      try {
        const [ovRes, balRes, earnRes] = await Promise.all([
          fetch("/api/payments/overview"),
          user ?
            fetch("/api/wallet/balance", { credentials: "include" })
          : Promise.resolve(null),
          user ?
            fetch("/api/profile/earnings", { credentials: "include" })
          : Promise.resolve(null),
        ]);

        if (!ovRes.ok) throw new Error("overview failed");
        setOverview(await ovRes.json());

        if (balRes?.ok) setUserBalance(await balRes.json());
        else if (!user) setUserBalance(null);

        if (earnRes?.ok) {
          const e = await earnRes.json();
          setEarnings({
            claimableUsd: e.claimableUsd ?? 0,
            authorizedUsd: e.authorizedUsd ?? 0,
            settledUsd: e.settledUsd ?? 0,
            githubLinked: Boolean(e.githubLinked),
          });
        } else {
          setEarnings(null);
        }
      } catch {
        if (!opts?.silent) toast.error("Could not load treasury");
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void load();
    const t = setInterval(() => void load({ silent: true }), 30_000);
    return () => clearInterval(t);
  }, [load]);

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
    if (!payoutWallet) {
      toast.error("No wallet on your account — sign in again or contact support");
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ walletAddress: payoutWallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      if (data.fxHint) setFxHint(data.fxHint);
      toast.success("Authorizations claimed");
      void load({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  const treasury = overview?.treasury;
  const ledger = overview?.ledger;
  const yourDeposits = userBalance?.availableUsd ?? 0;
  const yourClaimable = earnings?.claimableUsd ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-8">
      <header className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Capital
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Where should money move?</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          Deposit → authorize → claim. Your balance funds programs — not the platform agent wallet.
        </p>
        {!initialLoading && treasury && (
          <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
            <p className="font-medium text-amber-100">Recognized ≠ funded yet</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
              <Money amount={ledger?.authorizedUsd ?? 0} size="sm" className="inline text-white" />{" "}
              recognized across the network. Program operators deposit USDC to their treasury balance
              before authorizations become claimable — prevents spending platform escrow funds.
            </p>
            {user && yourDeposits < 0.01 && (ledger?.authorizedUsd ?? 0) > 0 && (
              <p className="mt-2 text-xs text-amber-200/90">
                Your deposit balance is $0 —{" "}
                <Link href="/profile" className="text-resolve-accent hover:underline">
                  add funds on Profile
                </Link>{" "}
                to fund programs you operate.
              </p>
            )}
          </div>
        )}
      </header>

      <section className="border-b border-resolve-border pb-8">
        <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
          Your treasury
        </p>
        {user ?
          <>
            <p className="mt-2 text-4xl font-semibold tabular-nums text-white">
              <Money amount={yourDeposits} size="lg" />
            </p>
            <p className="mt-2 text-sm text-resolve-muted">
              Deposited USDC in your RESOLVE account — funds programs and distributions you operate.
            </p>
            <Link
              href="/profile"
              className="mt-2 inline-block text-xs text-resolve-accent hover:underline"
            >
              Add funds on Profile →
            </Link>
          </>
        : <p className="mt-3 text-sm text-resolve-muted">
            Sign in to view your deposit balance.
          </p>
        }

        <div className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
            Settlement rail (platform)
          </p>
          <p className="mt-1 text-sm text-white">
            <Money amount={treasury?.balanceUsd ?? 0} size="sm" className="inline" /> on Arc
          </p>
          <p className="mt-1 text-xs text-resolve-muted">
            Agent escrow for on-chain memo transfers only — not a slush fund for user claims.
            {treasury?.fundingWallet ?
              ` ${treasury.fundingWallet.slice(0, 6)}…${treasury.fundingWallet.slice(-4)}`
            : ""}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-sm text-resolve-muted">
          <span>
            Network authorized:{" "}
            <Money amount={ledger?.authorizedUsd ?? 0} size="sm" className="inline" />
          </span>
          <span>
            Network claimable:{" "}
            <Money amount={ledger?.claimableUsd ?? 0} size="sm" className="inline" />
          </span>
          <span>
            Settled: <Money amount={ledger?.settledUsd ?? 0} size="sm" className="inline" />
          </span>
        </div>
        {refreshing && (
          <p className="mt-2 text-[10px] text-resolve-muted-dim">Refreshing…</p>
        )}
      </section>

      <section className="border-b border-resolve-border py-8">
        <CapitalCommunityPrograms />
      </section>

      <section className="border-b border-resolve-border py-8">
        <p className="text-sm font-semibold text-white">Pending</p>
        <p className="mt-3 text-sm text-resolve-muted">
          {user && earnings ?
            <>
              Your authorized:{" "}
              <Money amount={earnings.authorizedUsd} size="sm" className="inline" />
              {" · "}
              Your claimable:{" "}
              <Money amount={yourClaimable} size="sm" className="inline" />
            </>
          : <>
              Network authorized:{" "}
              <Money amount={ledger?.authorizedUsd ?? 0} size="sm" className="inline" />
            </>
          }
          {" · "}
          Awaiting deposit funding:{" "}
          <Money amount={ledger?.pendingFundingUsd ?? 0} size="sm" className="inline" />
        </p>
      </section>

      <section className="border-b border-resolve-border py-8">
        <p className="text-sm font-semibold text-white">Claims</p>
        {!user ?
          <div className="mt-4 space-y-3">
            <p className="text-sm text-resolve-muted">Sign in to collect your earnings.</p>
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
              <Money amount={yourClaimable} size="sm" className="inline" /> claimable for you
            </p>
            {!earnings?.githubLinked && (
              <p className="mt-1 text-xs text-amber-200/90">
                Link GitHub on Profile to match authorizations to your contributor identity.
              </p>
            )}
            {payoutWallet && (
              <p className="mt-2 font-mono text-xs text-resolve-muted">
                Payout wallet: {payoutWallet.slice(0, 6)}…{payoutWallet.slice(-4)} — one address
                for your whole account
              </p>
            )}
            {currencyOptions.length > 0 && (
              <CurrencySelect
                value={payoutCurrency}
                options={currencyOptions}
                onChange={(next) => {
                  setPayoutCurrency(next);
                  void fetch("/api/profile/payout-preference", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ currency: next }),
                  });
                }}
              />
            )}
            {fxHint && (
              <div className="mt-4">
                <FxSwapPanel hint={fxHint} />
              </div>
            )}
            <div className="mt-4">
              <Button
                onClick={() => void handleClaim()}
                disabled={claiming || yourClaimable <= 0 || !payoutWallet}
              >
                {claiming ? "Claiming…" : yourClaimable > 0 ? "Claim to your wallet" : "Nothing to claim yet"}
              </Button>
            </div>
          </>
        }
      </section>

      <section className="py-8">
        <p className="text-sm font-semibold text-white">History</p>
        <p className="mt-1 text-xs text-resolve-muted">
          Settlements show explorer verification — never optimistic paid state.
        </p>
        {initialLoading ?
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
            {overview?.recentAuthorizations.slice(0, 12).map((a) => (
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
