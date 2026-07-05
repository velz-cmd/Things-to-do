"use client";

import { useAccount } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useWalletActions } from "@/hooks/use-wallet-actions";

export function useResolveAccess() {
  const { loading: authLoading, supabaseConfigured } = useAuth();
  const account = useResolveAccount();
  const { isConnected } = useAccount();
  const wallet = useWalletActions();

  const signedIn =
    account.authMethod === "email" ||
    account.authMethod === "google" ||
    account.authMethod === "github" ||
    account.authMethod === "both";

  const externalReady = wallet.canPayWithConnectedWallet;
  const walletConnected =
    Boolean(account.walletAddress) || (isConnected && Boolean(account.externalWalletAddress)) || externalReady;

  /** Email/Google users can assign/lock/deploy after sign-in (embedded wallet auto-created). */
  const ready = signedIn;
  const cryptoReady = signedIn && (externalReady || Boolean(account.walletAddress));

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
    connectedWalletUsd: wallet.connectedBalanceUsd,
    walletSigning: wallet.walletSigning,
    spendableUsd: externalReady ? wallet.connectedBalanceUsd : undefined,
    fundProgramWithWallet: wallet.fundProgramWithWallet,
    openConnectWallet: wallet.openConnectWallet,
    authLoading: authLoading || account.loading,
    address: externalReady ? account.externalWalletAddress : account.walletAddress,
    isAuthenticated: account.isAuthenticated,
    account,
    message,
  };
}
