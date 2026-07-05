"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccess } from "@/hooks/use-resolve-access";

export type SpendableUsdSnapshot = {
  spendableUsd: number;
  totalUsdc: number;
  loaded: boolean;
  source: "onchain_wallet" | "onchain_app" | "ledger";
  walletAddress?: string;
  refresh: () => Promise<void>;
};

function spendableFromAuthBalance(balance: NonNullable<ReturnType<typeof useAuth>["balance"]>) {
  if (balance.onChainUsd != null && balance.syncStatus !== "no_wallet") {
    return {
      spendableUsd: balance.availableUsd,
      totalUsdc: balance.onChainUsd,
      source: "onchain_app" as const,
    };
  }
  return {
    spendableUsd: balance.availableUsd,
    totalUsdc: balance.onChainUsd ?? balance.availableUsd,
    source: "ledger" as const,
  };
}

/** Single spendable balance for Discover, Communities, Capital — on-chain first. */
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
        walletAddress: account.externalWalletAddress ?? account.appWalletAddress,
        refresh: refreshBalance,
      };
    }

    if (balance) {
      const fromChain = spendableFromAuthBalance(balance);
      return {
        ...fromChain,
        loaded: true,
        walletAddress: balance.walletAddress ?? account.appWalletAddress,
        refresh: refreshBalance,
      };
    }

    return {
      spendableUsd: 0,
      totalUsdc: 0,
      loaded: !balanceLoading,
      source: "ledger",
      walletAddress: account.appWalletAddress,
      refresh: refreshBalance,
    };
  }, [
    externalWalletReady,
    connectedWalletUsd,
    account.externalWalletAddress,
    account.appWalletAddress,
    balance,
    balanceLoading,
    refreshBalance,
  ]);
}
