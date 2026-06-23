"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useAccount } from "wagmi";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useResolveAccess() {
  const { user, loading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();

  const signedIn = Boolean(user);
  const walletConnected = isConnected && Boolean(address);
  /** Email-only users can assign/lock/deploy after sign-in (embedded wallet auto-created). */
  const ready = signedIn;
  const cryptoReady = signedIn && walletConnected;
  const supabaseReady = isSupabaseConfigured();

  let message: string | null = null;
  if (!supabaseReady) {
    message = "Sign-in is not configured on this deployment.";
  } else if (!signedIn) {
    message = null;
  }

  return {
    signedIn,
    walletConnected,
    ready,
    cryptoReady,
    authLoading,
    address,
    message,
  };
}
