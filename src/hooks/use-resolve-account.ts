"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";
import {
  clearGuestExploring,
  getLocalNotificationEmail,
  GUEST_CHANGE_EVENT,
  isGuestExploring,
} from "@/lib/auth/guest";
import type {
  AccountMode,
  ResolveAccountState,
  ResolveAuthMethod,
  ResolveWallet,
} from "@/lib/auth/types";

export type { ResolveAccountState, ResolveWallet } from "@/lib/auth/types";

function resolveAuthMethod(
  hasSupabase: boolean,
  hasWallet: boolean,
  provider?: string
): ResolveAuthMethod {
  if (hasSupabase && hasWallet) return "both";
  if (hasWallet) return "wallet";
  if (!hasSupabase) return "none";
  if (provider === "google") return "google";
  return "email";
}

function resolveMode(
  isGuest: boolean,
  hasSupabase: boolean,
  hasWallet: boolean,
  provider?: string
): AccountMode {
  if (isGuest && !hasSupabase && !hasWallet) return "guest";
  if (hasSupabase && hasWallet) return "both";
  if (hasWallet) return "wallet";
  if (!hasSupabase) return "none";
  if (provider === "google") return "google";
  return "email";
}

export function useResolveAccount(): ResolveAccountState {
  const { user, loading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();
  const [gmailConnected, setGmailConnected] = useState(false);
  const [arcConnected, setArcConnected] = useState(false);
  const [wallets, setWallets] = useState<ResolveWallet[]>([]);
  const [appWalletPending, setAppWalletPending] = useState(false);
  const [connectorsLoading, setConnectorsLoading] = useState(false);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [localNotificationEmail, setLocalNotificationEmail] = useState<
    string | undefined
  >();

  const walletAddress = isConnected && address ? address : undefined;
  const hasSupabase = Boolean(user);
  const hasWallet = Boolean(walletAddress);
  const userId = user?.id;
  const provider = user?.app_metadata?.provider as string | undefined;

  useEffect(() => {
    const syncGuest = () => {
      setIsGuest(isGuestExploring());
      setLocalNotificationEmail(getLocalNotificationEmail());
    };
    syncGuest();
    window.addEventListener(GUEST_CHANGE_EVENT, syncGuest);
    return () => window.removeEventListener(GUEST_CHANGE_EVENT, syncGuest);
  }, []);

  useEffect(() => {
    if (hasSupabase || hasWallet) {
      clearGuestExploring();
      setIsGuest(false);
    }
  }, [hasSupabase, hasWallet]);

  useEffect(() => {
    if (!userId) {
      setGmailConnected(false);
      setArcConnected(false);
      setWallets([]);
      setAppWalletPending(false);
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

    setWalletsLoading(true);
    fetch("/api/account/wallets", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setWallets(data.wallets ?? []);
        setAppWalletPending(Boolean(data.appWalletPending));
      })
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        if (!cancelled) setWalletsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo(() => {
    const email = user?.email ?? undefined;
    const notificationEmail = email ?? localNotificationEmail;
    const notificationEmailVerified = Boolean(email);

    const appWallet = wallets.find((w) => w.type === "app_managed");
    const externalWallet = wallets.find((w) => w.type === "external");
    const primaryWallet =
      wallets.find((w) => w.isPrimary) ?? externalWallet ?? appWallet;

    const displayWalletAddress = hasWallet
      ? walletAddress
      : primaryWallet?.address;

    const displayName =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      email?.split("@")[0] ??
      (displayWalletAddress
        ? `${displayWalletAddress.slice(0, 6)}…${displayWalletAddress.slice(-4)}`
        : undefined);

    const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
    const authMethod = resolveAuthMethod(hasSupabase, hasWallet, provider);
    const mode = resolveMode(isGuest, hasSupabase, hasWallet, provider);
    const isAuthenticated = hasSupabase || hasWallet;

    return {
      isAuthenticated,
      mode,
      authMethod,
      email,
      notificationEmail,
      notificationEmailVerified,
      walletAddress: displayWalletAddress,
      wallets,
      displayName,
      avatarUrl,
      gmailConnected,
      arcConnected,
      appWalletPending,
      loading:
        hasSupabase &&
        authLoading &&
        !hasWallet &&
        (connectorsLoading || walletsLoading),
    };
  }, [
    user,
    walletAddress,
    hasSupabase,
    hasWallet,
    provider,
    gmailConnected,
    arcConnected,
    wallets,
    appWalletPending,
    authLoading,
    connectorsLoading,
    walletsLoading,
    isGuest,
    localNotificationEmail,
  ]);
}
