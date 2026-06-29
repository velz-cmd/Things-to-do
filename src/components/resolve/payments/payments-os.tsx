"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { ResolveBanking } from "@/components/resolve/payments/resolve-banking";
import type { BankingAccountSnapshot } from "@/lib/banking/types";
import { bankingSnapshotFromWalletBalance } from "@/lib/banking/fallback-snapshot";
import { BANKING_UI } from "@/lib/banking/copy";

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

type WalletBalanceResponse = {
  availableUsd: number;
  onChainUsd?: number | null;
  reservedUsd?: number;
};

export function PaymentsOS() {
  const { user, refreshBalance, balance } = useAuth();
  const { openSignIn } = useSignInModal();
  const account = useResolveAccount();

  const [banking, setBanking] = useState<BankingAccountSnapshot | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const payoutWallet =
    account.appWalletAddress ?? account.walletAddress ?? account.externalWalletAddress;

  const applyWalletFallback = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/wallet/balance", {
        credentials: "include",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as WalletBalanceResponse;
      if (!user) return false;
      setBanking(
        bankingSnapshotFromWalletBalance({
          userId: user.id,
          email: user.email,
          displayName:
            (user.user_metadata?.full_name as string | undefined) ??
            user.email?.split("@")[0] ??
            null,
          walletAddress: payoutWallet ?? undefined,
          availableUsd: data.availableUsd,
          onChainUsd: data.onChainUsd ?? null,
          reservedUsd: data.reservedUsd ?? 0,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }, [payoutWallet, user]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) {
        setBanking(null);
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setRefreshing(true);
      let loaded = false;

      try {
        try {
          const bankRes = await fetch("/api/banking/account", {
            credentials: "include",
            signal: AbortSignal.timeout(25_000),
          });

          if (bankRes.ok) {
            const next = await bankRes.json();
            setBanking(next);
            loaded = true;
          }
        } catch {
          /* fall through to wallet balance */
        }

        if (!loaded) {
          loaded = await applyWalletFallback();
        }

        try {
          const ovRes = await fetch("/api/payments/overview", {
            credentials: "include",
            signal: AbortSignal.timeout(12_000),
          });
          if (ovRes.ok) {
            const ov = await ovRes.json();
            setOverview({
              settlements: ov.settlements ?? [],
              recentAuthorizations: ov.recentAuthorizations ?? [],
            });
          }
        } catch {
          /* overview is optional */
        }

        void refreshBalance();

        if (!loaded && !opts?.silent) {
          toast.error("Could not load your account");
        }
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [applyWalletFallback, refreshBalance, user],
  );

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }
    void load();
    const t = setInterval(() => void load({ silent: true }), 30_000);
    return () => clearInterval(t);
  }, [load, user]);

  useEffect(() => {
    if (!balance || !user || banking || initialLoading) return;
    void applyWalletFallback();
  }, [applyWalletFallback, balance, banking, initialLoading, user]);

  const displayAccount = useMemo(() => {
    if (banking) return banking;
    if (!balance || !user) return null;
    return bankingSnapshotFromWalletBalance({
      userId: user.id,
      email: user.email,
      displayName:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        null,
      walletAddress: payoutWallet ?? undefined,
      availableUsd: balance.availableUsd,
    });
  }, [balance, banking, payoutWallet, user]);

  async function handleClaim() {
    if (!payoutWallet) {
      toast.error("No wallet on your account — sign in again or contact support");
      return;
    }
  const claimable = displayAccount?.balances?.earnedClaimableUsd ?? 0;
  if (claimable <= 0) {
    toast.message(BANKING_UI.claimNothing);
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
      const total = data.totalUsd ?? 0;
      const claimed = Array.isArray(data.claimed) ? data.claimed : [];
      const settled = claimed.filter((c: { status?: string }) => c.status === "settled");
      if (total <= 0 || settled.length === 0) {
        toast.message(data.error ?? BANKING_UI.claimNothing);
        return;
      }
      toast.success(`${BANKING_UI.claimSuccess} — $${total.toFixed(2)}`);
      void load({ silent: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  function handleSignIn() {
    openSignIn();
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
        kind: "settlement" as const,
      })) ?? []),
      ...(overview?.recentAuthorizations.slice(0, 12).map((a) => ({
        id: a.id,
        label: a.contextLabel ?? a.missionId,
        amountUsd: a.amountUsd,
        txHash: null,
        status: a.status,
        at: a.updatedAt,
        kind: "authorization" as const,
      })) ?? []),
    ];
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [overview]);

  return (
    <ResolveBanking
      account={displayAccount}
      settlements={settlements}
      initialLoading={initialLoading && !displayAccount}
      refreshing={refreshing}
      signedIn={Boolean(user)}
      payoutWallet={payoutWallet ?? null}
      claiming={claiming}
      onClaim={() => void handleClaim()}
      onSignIn={handleSignIn}
    />
  );
}
