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
import { WALLET_LINKED_EVENT } from "@/components/wallet/wallet-link-effect";
import { embeddedWalletFor } from "@/lib/wallet/embedded";

export type { ResolveAccountState, ResolveWallet } from "@/lib/auth/types";

function resolveAuthMethod(
  hasSupabase: boolean,
  hasExternalWallet: boolean,
  provider?: string
): ResolveAuthMethod {
  if (hasSupabase && hasExternalWallet) return "both";
  if (hasExternalWallet && !hasSupabase) return "wallet";
  if (!hasSupabase) return "none";
  if (provider === "google") return "google";
  if (provider === "github") return "github";
  return "email";
}

function resolveMode(
  isGuest: boolean,
  hasSupabase: boolean,
  hasExternalWallet: boolean,
  provider?: string
): AccountMode {
  if (isGuest && !hasSupabase && !hasExternalWallet) return "guest";
  if (hasSupabase && hasExternalWallet) return "both";
  if (hasExternalWallet && !hasSupabase) return "wallet";
  if (!hasSupabase) return "none";
  if (provider === "google") return "google";
  if (provider === "github") return "github";
  return "email";
}

export function useResolveAccount(): ResolveAccountState {
  const { user, loading: authLoading } = useAuth();
  const { address, isConnected } = useAccount();
  const [gmailInboxConnected, setGmailInboxConnected] = useState(false);
  const [arcConnected, setArcConnected] = useState(false);
  const [wallets, setWallets] = useState<ResolveWallet[]>([]);
  const [appWalletPending, setAppWalletPending] = useState(false);
  const [connectorsLoading, setConnectorsLoading] = useState(false);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [localNotificationEmail, setLocalNotificationEmail] = useState<
    string | undefined
  >();

  const wagmiAddress =
    isConnected && address ? address.toLowerCase() : undefined;
  const hasSupabase = Boolean(user);
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
    if (hasSupabase || wagmiAddress) {
      clearGuestExploring();
      setIsGuest(false);
    }
  }, [hasSupabase, wagmiAddress]);

  useEffect(() => {
    if (!userId) {
      setGmailInboxConnected(false);
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
        setGmailInboxConnected(gmail?.state === "connected");
        setArcConnected(arc?.state === "connected");
      })
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        if (!cancelled) setConnectorsLoading(false);
      });

    setWalletsLoading(true);

    const deterministic =
      userId ? embeddedWalletFor(userId).toLowerCase() : undefined;
    if (deterministic) {
      setWallets([
        {
          id: `app-${userId}`,
          type: "app_managed",
          chain: "evm",
          address: deterministic,
          provider: "embedded",
          isPrimary: true,
          createdAt: new Date().toISOString(),
        },
      ]);
      setAppWalletPending(false);
    }

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

  useEffect(() => {
    if (!userId) return;

    function refreshWallets() {
      setWalletsLoading(true);
      fetch("/api/account/wallets", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setWallets(data.wallets ?? []);
          setAppWalletPending(Boolean(data.appWalletPending));
        })
        .catch(() => {
          /* non-fatal */
        })
        .finally(() => setWalletsLoading(false));
    }

    window.addEventListener(WALLET_LINKED_EVENT, refreshWallets);
    return () => window.removeEventListener(WALLET_LINKED_EVENT, refreshWallets);
  }, [userId]);

  return useMemo(() => {
    const email = user?.email ?? undefined;
    const notificationEmail = email ?? localNotificationEmail;
    const notificationEmailVerified = Boolean(email);
    const accountVerified = hasSupabase;

    const appWallet = wallets.find((w) => w.type === "app_managed");
    const externalFromApi = wallets.find((w) => w.type === "external");
    const appWalletAddress = appWallet?.address;
    const externalWalletAddress =
      externalFromApi?.address ?? wagmiAddress ?? undefined;

    const hasExternalWallet = Boolean(externalWalletAddress);
    const authMethod = resolveAuthMethod(hasSupabase, hasExternalWallet, provider);
    const mode = resolveMode(isGuest, hasSupabase, hasExternalWallet, provider);

    const walletOnly = mode === "wallet";
    const walletAddress = walletOnly
      ? externalWalletAddress
      : appWalletAddress ?? externalWalletAddress;

    const displayName =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      email?.split("@")[0] ??
      (walletAddress
        ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
        : undefined);

    const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
    const isAuthenticated = hasSupabase || hasExternalWallet;

    return {
      isAuthenticated,
      mode,
      authMethod,
      email,
      notificationEmail,
      notificationEmailVerified,
      appWalletAddress,
      externalWalletAddress,
      walletAddress,
      wallets,
      displayName,
      avatarUrl,
      accountVerified,
      gmailInboxConnected,
      arcConnected,
      appWalletPending,
      appWalletProvider: appWallet?.provider as "circle" | "embedded" | undefined,
      loading:
        hasSupabase &&
        authLoading &&
        !hasExternalWallet &&
        (connectorsLoading || walletsLoading),
    };
  }, [
    user,
    wagmiAddress,
    hasSupabase,
    provider,
    gmailInboxConnected,
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
