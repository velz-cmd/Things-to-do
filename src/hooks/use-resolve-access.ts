"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccount } from "@/hooks/use-resolve-account";

export function useResolveAccess() {
  const { loading: authLoading, supabaseConfigured } = useAuth();
  const account = useResolveAccount();

  const signedIn =
    account.authMethod === "email" ||
    account.authMethod === "google" ||
    account.authMethod === "github" ||
    account.authMethod === "both";
  const walletConnected = Boolean(account.walletAddress);
  /** Email/Google users can assign/lock/deploy after sign-in (embedded wallet auto-created). */
  const ready = signedIn;
  const cryptoReady = signedIn && walletConnected;

  let message: string | null = null;
  if (!supabaseConfigured && process.env.NODE_ENV === "development") {
    message = "Sign-in is not configured on this deployment.";
  }

  return {
    signedIn,
    walletConnected,
    ready,
    cryptoReady,
    authLoading: authLoading || account.loading,
    address: account.walletAddress,
    isAuthenticated: account.isAuthenticated,
    account,
    message,
  };
}
