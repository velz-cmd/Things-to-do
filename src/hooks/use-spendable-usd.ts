"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccess } from "@/hooks/use-resolve-access";

export type SpendableUsdSnapshot = {
  spendableUsd: number;
  totalUsdc: number;
  loaded: boolean;
  source: "onchain_wallet" | "ledger";
  walletAddress?: string;
  refresh: () => Promise<void>;
};

/** Single spendable balance for Discover, Communities, Capital — on-chain wallet first. */
export function useSpendableUsd(): SpendableUsdSnapshot {
  const { balance, balanceLoading, refreshBalance } = useAuth();
  const { externalWalletReady, connectedWalletUsd, account } = useResolveAccess();

  return useMemo((): SpendableUsdSnapshot => {
    if (externalWalletReady) {
      return {
        spendableUsd: connectedWalletUsd,
        totalUsdc: connectedWalletUsd,
        loaded: true,
        source: "onchain_wallet",
        walletAddress: account.externalWalletAddress,
        refresh: refreshBalance,
      };
    }

    const spendable = balance?.availableUsd ?? 0;
    const total = balance?.onChainUsd ?? balance?.availableUsd ?? 0;

    return {
      spendableUsd: spendable,
      totalUsdc: typeof total === "number" ? total : Number(total) || 0,
      loaded: Boolean(balance) || !balanceLoading,
      source: "ledger",
      walletAddress: balance?.walletAddress,
      refresh: refreshBalance,
    };
  }, [
    externalWalletReady,
    connectedWalletUsd,
    account.externalWalletAddress,
    balance,
    balanceLoading,
    refreshBalance,
  ]);
}
