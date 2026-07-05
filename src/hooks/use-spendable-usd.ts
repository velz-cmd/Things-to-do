"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useConnectedArcBalance } from "@/hooks/use-connected-arc-balance";
import { useActiveWalletView } from "@/hooks/use-active-wallet-view";
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
  appOnChainUsd?: number | null;
  externalOnChainUsd?: number | null;
  externalReady: boolean;
  pickSource: (amountUsd: number, preferred?: FundingSource | null) => FundingSource | null;
  refresh: () => Promise<void>;
};

/**
 * Per-wallet Arc balances from server RPC + optional live connected wallet.
 * Never labels aggregated totals as the Gmail wallet.
 */
export function useSpendableUsd(): SpendableUsdSnapshot {
  const { balance, balanceLoading, refreshBalance } = useAuth();
  const account = useResolveAccount();
  const { view: activeView } = useActiveWalletView();
  const { address, isConnected } = useAccount();
  const connectedBalance = useConnectedArcBalance();

  const appWalletAddress =
    balance?.appWalletAddress ?? account.appWalletAddress ?? balance?.walletAddress;
  const externalWalletAddress =
    balance?.externalWalletAddress ?? account.externalWalletAddress;

  const linkedExternal = externalWalletAddress?.toLowerCase();
  const connectedAddr = address?.toLowerCase();
  const externalLinked =
    Boolean(linkedExternal) && Boolean(connectedAddr) && linkedExternal === connectedAddr;
  const externalConnected = isWalletConnectEnabled() && isConnected && Boolean(connectedAddr);
  const externalReady = externalConnected && (externalLinked || !linkedExternal);

  return useMemo((): SpendableUsdSnapshot => {
    let appSpendableUsd =
      balance?.appSpendableUsd ??
      (balance?.appOnChainUsd != null ? balance.appOnChainUsd : balance?.availableUsd ?? 0);
    let appOnChainUsd = balance?.appOnChainUsd ?? balance?.onChainUsd ?? null;

    let externalSpendableUsd = balance?.externalSpendableUsd ?? 0;
    let externalOnChainUsd = balance?.externalOnChainUsd ?? null;

    if (externalReady && connectedBalance.loaded) {
      externalSpendableUsd = connectedBalance.usdc;
      externalOnChainUsd = connectedBalance.usdc;
    }

    appSpendableUsd = Math.round(appSpendableUsd * 100) / 100;
    externalSpendableUsd = Math.round(externalSpendableUsd * 100) / 100;

    const balances = { appSpendableUsd, externalSpendableUsd };
    const combinedSpendable = maxSpendableUsd(balances, externalReady);

    const viewSpendable =
      activeView === "external" && externalWalletAddress
        ? externalSpendableUsd
        : appSpendableUsd;

    const viewOnChain =
      activeView === "external" && externalWalletAddress
        ? externalOnChainUsd
        : appOnChainUsd;

    let source: SpendableUsdSnapshot["source"] = "ledger";
    if (balance?.syncStatus === "live" || balance?.syncStatus === "cached") {
      source = externalReady && externalSpendableUsd > 0 && appSpendableUsd > 0
        ? "dual"
        : externalReady && externalSpendableUsd >= appSpendableUsd
          ? "onchain_wallet"
          : "onchain_app";
    }

    const loaded =
      !balanceLoading &&
      Boolean(appWalletAddress) &&
      (balance != null || !account.walletsLoading);

    return {
      spendableUsd: combinedSpendable,
      appSpendableUsd,
      externalSpendableUsd,
      totalUsdc: Math.max(
        viewOnChain ?? 0,
        appOnChainUsd ?? 0,
        externalOnChainUsd ?? 0,
        combinedSpendable,
      ),
      loaded: loaded || (externalConnected && connectedBalance.loaded),
      source,
      walletAddress:
        activeView === "external" && externalWalletAddress
          ? externalWalletAddress
          : appWalletAddress ?? externalWalletAddress,
      appWalletAddress,
      externalWalletAddress,
      appOnChainUsd,
      externalOnChainUsd,
      externalReady,
      pickSource: (amountUsd: number, preferred?: FundingSource | null) =>
        pickFundingSource(amountUsd, balances, externalReady, preferred),
      refresh: refreshBalance,
    };
  }, [
    balance,
    balanceLoading,
    account.appWalletAddress,
    account.externalWalletAddress,
    account.walletsLoading,
    activeView,
    appWalletAddress,
    externalWalletAddress,
    connectedAddr,
    connectedBalance.loaded,
    connectedBalance.usdc,
    externalConnected,
    externalReady,
    refreshBalance,
  ]);
}
