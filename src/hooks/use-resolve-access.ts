"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useAccount } from "wagmi";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useResolveAccess() {
  const { user, loading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();

  const signedIn = Boolean(user);
  const walletConnected = isConnected && Boolean(address);
  const ready = signedIn && walletConnected;
  const supabaseReady = isSupabaseConfigured();

  let message: string | null = null;
  if (!supabaseReady) {
    message = "Sign-in is not configured on this deployment.";
  } else if (!signedIn) {
    message = "Sign in with Google or email to assign outcomes.";
  } else if (!walletConnected) {
    message = "Connect your crypto wallet to lock funds and deploy missions.";
  }

  return {
    signedIn,
    walletConnected,
    ready,
    authLoading,
    address,
    message,
  };
}
