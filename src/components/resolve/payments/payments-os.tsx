"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { ResolveBanking } from "@/components/resolve/payments/resolve-banking";
import type { BankingAccountSnapshot } from "@/lib/banking/types";
import { bankingSnapshotFromWalletBalance } from "@/lib/banking/fallback-snapshot";
import {
  mergeWalletBalanceIntoSnapshot,
  normalizeBankingSnapshot,
} from "@/lib/banking/normalize-snapshot";
import { BANKING_UI } from "@/lib/banking/copy";

const REFRESH_INTERVAL_MS = 15_000;

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

async function fetchWalletBalance(): Promise<WalletBalanceResponse | null> {
  try {
    const res = await fetch("/api/wallet/balance", {
      credentials: "include",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as WalletBalanceResponse;
  } catch {
    return null;
  }
}

export function PaymentsOS() {
  const { user, refreshBalance, balance } = useAuth();
  const { openSignIn } = useSignInModal();
  const account = useResolveAccount();

  const [banking, setBanking] = useState<BankingAccountSnapshot | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const payoutWallet =
    account.appWalletAddress ?? account.walletAddress ?? account.externalWalletAddress;

  const buildWalletOnlySnapshot = useCallback(
    (wallet: WalletBalanceResponse): BankingAccountSnapshot | null => {
      if (!user) return null;
      return bankingSnapshotFromWalletBalance({
        userId: user.id,
        email: user.email,
        displayName:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email?.split("@")[0] ??
          null,
        walletAddress: payoutWallet ?? undefined,
        availableUsd: wallet.availableUsd,
        onChainUsd: wallet.onChainUsd ?? null,
        reservedUsd: wallet.reservedUsd ?? 0,
      });
    },
    [payoutWallet, user],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean; syncOnChain?: boolean }) => {
      if (!user) {
        setBanking(null);
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setRefreshing(true);
      let loaded = false;

      try {
        if (opts?.syncOnChain) {
          try {
            await fetch("/api/wallet/sync", {
              method: "POST",
              credentials: "include",
              signal: AbortSignal.timeout(15_000),
            });
          } catch {
            /* sync is best-effort */
          }
        }

        const [bankResult, walletResult] = await Promise.allSettled([
          fetch("/api/banking/account", {
            credentials: "include",
            signal: AbortSignal.timeout(25_000),
          }),
          fetchWalletBalance(),
        ]);

        const wallet =
          walletResult.status === "fulfilled" ? walletResult.value : null;

        if (bankResult.status === "fulfilled" && bankResult.value.ok) {
          const raw = await bankResult.value.json();
          let snapshot = normalizeBankingSnapshot(raw);
          if (snapshot && wallet) {
            snapshot = mergeWalletBalanceIntoSnapshot(snapshot, wallet);
          }
          if (snapshot) {
            setBanking(snapshot);
            loaded = true;
          }
        }

        if (!loaded && wallet) {
          const fallback = buildWalletOnlySnapshot(wallet);
          if (fallback) {
            setBanking(fallback);
            loaded = true;
          }
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
        setLastRefreshedAt(new Date());

        if (!loaded && !opts?.silent) {
          toast.error("Could not load your account");
        }
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [buildWalletOnlySnapshot, refreshBalance, user],
  );

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }
    void load({ syncOnChain: true });
    const t = setInterval(() => void load({ silent: true }), REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load, user]);

  useEffect(() => {
    if (!balance || !user || banking || initialLoading) return;
    void fetchWalletBalance().then((wallet) => {
      if (!wallet) return;
      setBanking(buildWalletOnlySnapshot(wallet));
    });
  }, [balance, banking, buildWalletOnlySnapshot, initialLoading, user]);

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
      void load({ silent: true, syncOnChain: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  function handleRefresh() {
    void load({ silent: false, syncOnChain: true });
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
      lastRefreshedAt={lastRefreshedAt}
      onClaim={() => void handleClaim()}
      onRefresh={handleRefresh}
      onSignIn={handleSignIn}
    />
  );
}
