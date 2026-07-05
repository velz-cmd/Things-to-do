"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useConnectedArcBalance } from "@/hooks/use-connected-arc-balance";
import { isWalletConnectEnabled } from "@/lib/reown/config";
import {
  maxSpendableUsd,
  pickFundingSource,
  type FundingSource,
} from "@/lib/wallet/funding-source";

export type SpendableUsdSnapshot = {
  spendableUsd: number;
  appSpendableUsd: number;
  externalSpendableUsd: number;
  totalUsdc: number;
  loaded: boolean;
  source: "onchain_wallet" | "onchain_app" | "ledger" | "dual";
  walletAddress?: string;
  appWalletAddress?: string;
  externalWalletAddress?: string;
  externalReady: boolean;
  pickSource: (amountUsd: number) => FundingSource | null;
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

/**
 * Spendable balances for Capital, Discover, Communities.
 * Gmail RESOLVE wallet (app) and optional external wallet coexist — funding picks the best source.
 */
export function useSpendableUsd(): SpendableUsdSnapshot {
  const { balance, balanceLoading, refreshBalance } = useAuth();
  const account = useResolveAccount();
  const { address, isConnected } = useAccount();
  const connectedBalance = useConnectedArcBalance();

  const linkedExternal = account.externalWalletAddress?.toLowerCase();
  const connectedAddr = address?.toLowerCase();
  const externalLinked =
    Boolean(linkedExternal) && Boolean(connectedAddr) && linkedExternal === connectedAddr;
  const externalConnected = isWalletConnectEnabled() && isConnected && Boolean(connectedAddr);

  const externalReady = externalConnected && (externalLinked || !linkedExternal);

  return useMemo((): SpendableUsdSnapshot => {
    const appWalletAddress = account.appWalletAddress ?? balance?.walletAddress;
    const externalWalletAddress =
      account.externalWalletAddress ?? (externalConnected ? connectedAddr : undefined);

    let appSpendableUsd = 0;
    let totalUsdc = 0;
    let source: SpendableUsdSnapshot["source"] = "ledger";
    let loaded = !balanceLoading;

    if (balance) {
      const fromChain = spendableFromAuthBalance(balance);
      appSpendableUsd = fromChain.spendableUsd;
      totalUsdc = fromChain.totalUsdc;
      source = fromChain.source;
      loaded = true;
    } else if (appWalletAddress) {
      loaded = !balanceLoading;
    }

    const externalSpendableUsd =
      externalConnected && connectedBalance.loaded ? connectedBalance.usdc : 0;

    const balances = { appSpendableUsd, externalSpendableUsd };
    const spendableUsd = maxSpendableUsd(balances, externalReady);

    if (externalReady && externalSpendableUsd > 0 && appSpendableUsd > 0) {
      source = "dual";
    } else if (externalReady && externalSpendableUsd >= appSpendableUsd) {
      source = "onchain_wallet";
    }

    return {
      spendableUsd,
      appSpendableUsd,
      externalSpendableUsd,
      totalUsdc: Math.max(totalUsdc, externalSpendableUsd, appSpendableUsd),
      loaded: loaded || (externalConnected && connectedBalance.loaded),
      source,
      walletAddress: appWalletAddress ?? externalWalletAddress,
      appWalletAddress,
      externalWalletAddress,
      externalReady,
      pickSource: (amountUsd: number) =>
        pickFundingSource(amountUsd, balances, externalReady),
      refresh: refreshBalance,
    };
  }, [
    account.appWalletAddress,
    account.externalWalletAddress,
    balance,
    balanceLoading,
    connectedAddr,
    connectedBalance.loaded,
    connectedBalance.usdc,
    externalConnected,
    externalReady,
    refreshBalance,
  ]);
}
