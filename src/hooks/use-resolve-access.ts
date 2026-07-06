"use client";

import { useAccount } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useWalletActions } from "@/hooks/use-wallet-actions";
import { useSpendableUsd } from "@/hooks/use-spendable-usd";

export function useResolveAccess() {
  const { loading: authLoading, supabaseConfigured } = useAuth();
  const account = useResolveAccount();
  const { isConnected } = useAccount();
  const wallet = useWalletActions();
  const spendable = useSpendableUsd();

  const signedIn =
    account.authMethod === "email" ||
    account.authMethod === "google" ||
    account.authMethod === "github" ||
    account.authMethod === "both";

  const externalReady = spendable.externalReady && wallet.canPayWithConnectedWallet;
  const hasAppWallet = Boolean(account.appWalletAddress);
  const walletConnected = hasAppWallet || externalReady || (isConnected && Boolean(account.externalWalletAddress));

  const ready = signedIn;
  const cryptoReady = signedIn && (hasAppWallet || externalReady);

  let message: string | null = null;
  if (!supabaseConfigured && process.env.NODE_ENV === "development") {
    message = "Sign-in is not configured on this deployment.";
  }

  return {
    signedIn,
    walletConnected,
    ready,
    cryptoReady,
    externalWalletReady: externalReady,
    connectedWalletUsd: spendable.externalSpendableUsd,
    appWalletUsd: spendable.appSpendableUsd,
    walletSigning: wallet.walletSigning,
    spendableUsd: spendable.spendableUsd,
    pickFundingSource: spendable.pickSource,
    fundProgramWithWallet: wallet.fundProgramWithWallet,
    payAgentSignalWithWallet: wallet.payAgentSignalWithWallet,
    openConnectWallet: wallet.openConnectWallet,
    authLoading: authLoading || account.loading,
    address: account.appWalletAddress ?? account.externalWalletAddress ?? account.walletAddress,
    appWalletAddress: account.appWalletAddress,
    externalWalletAddress: account.externalWalletAddress,
    isAuthenticated: account.isAuthenticated,
    account,
    message,
  };
}
