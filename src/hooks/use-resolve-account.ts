"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";

export type ResolveAccountState = {
  isAuthenticated: boolean;
  authMethod: "supabase" | "wallet" | "both" | "none";
  email?: string;
  walletAddress?: string;
  displayName?: string;
  avatarUrl?: string;
  gmailConnected: boolean;
  arcConnected: boolean;
  loading: boolean;
};

export function useResolveAccount(): ResolveAccountState {
  const { user, loading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();
  const [gmailConnected, setGmailConnected] = useState(false);
  const [arcConnected, setArcConnected] = useState(false);
  const [connectorsLoading, setConnectorsLoading] = useState(false);

  const walletAddress = isConnected && address ? address : undefined;
  const hasSupabase = Boolean(user);
  const hasWallet = Boolean(walletAddress);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setGmailConnected(false);
      setArcConnected(false);
      return;
    }

    let cancelled = false;
    setConnectorsLoading(true);
    fetch("/api/connectors/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.connectors) return;
        const gmail = data.connectors.find(
          (c: { id: string; state: string }) => c.id === "gmail"
        );
        const arc = data.connectors.find(
          (c: { id: string; state: string }) => c.id === "arc"
        );
        setGmailConnected(gmail?.state === "connected");
        setArcConnected(arc?.state === "connected");
      })
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        if (!cancelled) setConnectorsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo(() => {
    const email = user?.email ?? undefined;
    const displayName =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      email?.split("@")[0] ??
      (walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : undefined);
    const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

    let authMethod: ResolveAccountState["authMethod"] = "none";
    if (hasSupabase && hasWallet) authMethod = "both";
    else if (hasSupabase) authMethod = "supabase";
    else if (hasWallet) authMethod = "wallet";

    return {
      isAuthenticated: hasSupabase || hasWallet,
      authMethod,
      email,
      walletAddress,
      displayName,
      avatarUrl,
      gmailConnected,
      arcConnected,
      loading: (authLoading && !hasWallet && !hasSupabase) || (hasSupabase && connectorsLoading),
    };
  }, [
    user,
    walletAddress,
    hasSupabase,
    hasWallet,
    gmailConnected,
    arcConnected,
    authLoading,
    connectorsLoading,
  ]);
}
