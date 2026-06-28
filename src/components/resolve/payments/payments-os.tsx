"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuthCapabilities } from "@/hooks/use-auth-capabilities";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { ResolveBanking } from "@/components/resolve/payments/resolve-banking";
import type { BankingAccountSnapshot } from "@/lib/banking/types";
import type { FxSwapHint, PayoutCurrency } from "@/lib/settlement/fx";

type Overview = {
  recentAuthorizations: {
    id: string;
    missionId: string;
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

export function PaymentsOS() {
  const { user, signInWithGitHub, githubEnabled } = useAuth();
  const { openSignIn } = useSignInModal();
  const capabilities = useAuthCapabilities();
  const account = useResolveAccount();
  const githubOAuthReady = capabilities.loaded && capabilities.github;

  const [banking, setBanking] = useState<BankingAccountSnapshot | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
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
        const [bankRes, ovRes] = await Promise.all([
          fetch("/api/banking/account", { credentials: "include" }),
          fetch("/api/payments/overview"),
        ]);

        if (!bankRes.ok) throw new Error("banking account failed");
        setBanking(await bankRes.json());

        if (ovRes.ok) {
          const ov = await ovRes.json();
          setOverview({
            settlements: ov.settlements ?? [],
            recentAuthorizations: ov.recentAuthorizations ?? [],
          });
        }
      } catch {
        if (!opts?.silent) toast.error("Could not load banking account");
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [],
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

  function handleSignIn() {
    if (githubOAuthReady && githubEnabled) signInWithGitHub();
    else openSignIn();
  }

  const settlements = useMemo(() => {
    const rows = [
      ...(overview?.settlements.map((s) => ({
        id: s.id,
        label: s.repo ?? s.missionId,
        amountUsd: s.treasuryAmount,
        txHash: s.escrowTxHash,
        status: s.status,
        at: s.createdAt,
      })) ?? []),
      ...(overview?.recentAuthorizations.slice(0, 12).map((a) => ({
        id: a.id,
        label: a.contextLabel ?? a.missionId,
        amountUsd: a.amountUsd,
        txHash: null,
        status: a.status,
        at: a.updatedAt,
      })) ?? []),
    ];
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [overview]);

  return (
    <ResolveBanking
      account={banking}
      settlements={settlements}
      initialLoading={initialLoading}
      refreshing={refreshing}
      signedIn={Boolean(user)}
      payoutWallet={payoutWallet ?? null}
      payoutCurrency={payoutCurrency}
      currencyOptions={currencyOptions}
      fxHint={fxHint}
      claiming={claiming}
      onPayoutCurrencyChange={(next) => {
        setPayoutCurrency(next);
        void fetch("/api/profile/payout-preference", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currency: next }),
        });
      }}
      onClaim={() => void handleClaim()}
      onSignIn={handleSignIn}
    />
  );
}
