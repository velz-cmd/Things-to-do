"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useConnectedArcBalance } from "@/hooks/use-connected-arc-balance";
import { useActiveWalletView } from "@/hooks/use-active-wallet-view";
import { isWalletConnectEnabled } from "@/lib/reown/config";
import {
  mergeArcBalanceSnapshot,
  pickSnapshotUsd,
  readArcBalanceSnapshot,
} from "@/lib/wallet/arc-balance-snapshot";
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
  externalLinked: boolean;
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

  const hasLinkedExternal = Boolean(
    externalWalletAddress &&
      externalWalletAddress.toLowerCase() !== appWalletAddress?.toLowerCase(),
  );

  const linkedExternal = externalWalletAddress?.toLowerCase();
  const connectedAddr = address?.toLowerCase();
  const externalAddressMatch =
    Boolean(linkedExternal) && Boolean(connectedAddr) && linkedExternal === connectedAddr;
  const externalConnected = isWalletConnectEnabled() && isConnected && Boolean(connectedAddr);
  const externalReady = externalConnected && (externalAddressMatch || !linkedExternal);

  return useMemo((): SpendableUsdSnapshot => {
    const snapshot = readArcBalanceSnapshot();

    let appSpendableUsd =
      balance?.appSpendableUsd ??
      (balance?.appOnChainUsd != null ? balance.appOnChainUsd : balance?.availableUsd ?? 0);
    let appOnChainUsd = balance?.appOnChainUsd ?? balance?.onChainUsd ?? null;

    let externalSpendableUsd = balance?.externalSpendableUsd ?? 0;
    let externalOnChainUsd = balance?.externalOnChainUsd ?? null;

    const snapApp = pickSnapshotUsd("app", snapshot);
    const snapExt = pickSnapshotUsd("external", snapshot);
    if ((appOnChainUsd == null || appOnChainUsd <= 0) && snapApp != null) {
      appOnChainUsd = snapApp;
      if (appSpendableUsd <= 0) appSpendableUsd = snapApp;
    }
    if (hasLinkedExternal && (externalOnChainUsd == null || externalOnChainUsd <= 0) && snapExt != null) {
      externalOnChainUsd = snapExt;
      if (externalSpendableUsd <= 0) externalSpendableUsd = snapExt;
    }

    if (externalReady && connectedBalance.loaded) {
      externalSpendableUsd = connectedBalance.usdc;
      externalOnChainUsd = connectedBalance.usdc;
      mergeArcBalanceSnapshot({
        externalAddress: externalWalletAddress ?? undefined,
        externalOnChainUsd: connectedBalance.usdc,
        allowZero: true,
      });
    } else if (
      balance?.syncStatus === "live" &&
      externalOnChainUsd != null &&
      hasLinkedExternal
    ) {
      mergeArcBalanceSnapshot({
        externalAddress: externalWalletAddress ?? undefined,
        externalOnChainUsd,
        allowZero: true,
      });
    }

    if (balance?.syncStatus === "live" && appOnChainUsd != null) {
      mergeArcBalanceSnapshot({
        appAddress: appWalletAddress ?? undefined,
        appOnChainUsd,
        allowZero: true,
      });
    }

    appSpendableUsd = Math.round(appSpendableUsd * 100) / 100;
    externalSpendableUsd = Math.round(externalSpendableUsd * 100) / 100;

    const balances = { appSpendableUsd, externalSpendableUsd };
    const combinedSpendable = maxSpendableUsd(balances, externalReady || hasLinkedExternal);

    const viewOnChain =
      activeView === "external" && externalWalletAddress
        ? externalOnChainUsd
        : appOnChainUsd;

    let source: SpendableUsdSnapshot["source"] = "ledger";
    if (balance?.syncStatus === "live" || balance?.syncStatus === "cached") {
      source =
        (externalReady || hasLinkedExternal) &&
        externalSpendableUsd > 0 &&
        appSpendableUsd > 0
          ? "dual"
          : (externalReady || hasLinkedExternal) && externalSpendableUsd >= appSpendableUsd
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
      externalLinked: hasLinkedExternal,
      pickSource: (amountUsd: number, preferred?: FundingSource | null) =>
        pickFundingSource(amountUsd, balances, externalReady, preferred),
      refresh: refreshBalance,
    };
  }, [
    balance,
    balanceLoading,
    account.walletsLoading,
    activeView,
    appWalletAddress,
    externalWalletAddress,
    hasLinkedExternal,
    connectedBalance.loaded,
    connectedBalance.usdc,
    externalConnected,
    externalReady,
    refreshBalance,
  ]);
}
