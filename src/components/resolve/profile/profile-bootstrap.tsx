"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { ProfileIdentityState } from "@/app/api/profile/identities/route";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import { useProfileBootstrapQuery } from "@/lib/query/hooks";

type CommunitySummary = { slug: string; name: string; installed: boolean };

type BootstrapData = {
  signedIn: boolean;
  email: string | null;
  emailVerified: boolean;
  identities: ProfileIdentityState[];
  earnings: Record<string, unknown> | null;
  communities: CommunitySummary[];
  wallet: { address: string; embedded: boolean; provider: string } | null;
  dbDegraded?: boolean;
  error?: string;
};

function offlineIdentitiesForUser(userId: string): ProfileIdentityState[] {
  const walletAddress = embeddedWalletFor(userId).toLowerCase();
  return [
    {
      id: "github",
      connected: false,
      hint: "Connect GitHub to claim code contributions",
      authorizeUrl: "/connect/github",
    },
    {
      id: "wallet",
      connected: true,
      displayValue: `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`,
      hint: "Your RESOLVE wallet on Arc — unique to your account",
      health: "healthy",
    },
    {
      id: "navidrome",
      connected: false,
      hint: "Optional — ListenBrainz covers most listeners",
    },
    {
      id: "jellyfin",
      connected: false,
      hint: "Connect Jellyfin - one click",
      authorizeUrl: "/connect/jellyfin",
    },
    {
      id: "listenbrainz",
      connected: false,
      hint: "Connect MusicBrainz — one click",
      authorizeUrl: "/connect/listenbrainz",
    },
    {
      id: "gmail",
      connected: false,
      hint: "Optional — receipt-based claims",
      authorizeUrl: "/api/connectors/gmail/authorize?returnTo=/profile",
    },
  ];
}

function offlineWalletForUser(userId: string) {
  const address = embeddedWalletFor(userId).toLowerCase();
  return { address, embedded: true, provider: "embedded" as const };
}

const ProfileBootstrapContext = createContext<{
  data: BootstrapData | null;
  loading: boolean;
  reload: () => void;
}>({ data: null, loading: true, reload: () => undefined });

export function ProfileBootstrapProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const query = useProfileBootstrapQuery(Boolean(user));

  const data = useMemo((): BootstrapData | null => {
    if (!user) {
      return {
        signedIn: false,
        email: null,
        emailVerified: false,
        identities: [],
        earnings: null,
        communities: [],
        wallet: null,
      };
    }
    const body = query.data as Record<string, unknown> | undefined;
    if (!body) {
      return {
        signedIn: true,
        email: user.email ?? null,
        emailVerified: Boolean(user.email_confirmed_at ?? user.email),
        identities: offlineIdentitiesForUser(user.id),
        earnings: null,
        communities: [],
        wallet: offlineWalletForUser(user.id),
        dbDegraded: query.isError,
        error: query.error instanceof Error ? query.error.message : undefined,
      };
    }

    const wallet =
      (body.wallet as BootstrapData["wallet"]) ?? offlineWalletForUser(user.id);

    if (!body.ok) {
      return {
        signedIn: true,
        email: user.email ?? null,
        emailVerified: Boolean(user.email_confirmed_at ?? user.email),
        identities:
          Array.isArray(body.identities) && body.identities.length
            ? (body.identities as ProfileIdentityState[])
            : offlineIdentitiesForUser(user.id),
        earnings: (body.earnings as Record<string, unknown>) ?? null,
        communities: (body.communities as CommunitySummary[]) ?? [],
        wallet,
        dbDegraded: true,
        error: body.error as string | undefined,
      };
    }

    return {
      signedIn: true,
      email: (body.email as string) ?? user.email ?? null,
      emailVerified: Boolean(body.emailVerified ?? user.email),
      identities:
        Array.isArray(body.identities) && body.identities.length
          ? (body.identities as ProfileIdentityState[])
          : offlineIdentitiesForUser(user.id),
      earnings: (body.earnings as Record<string, unknown>) ?? null,
      communities: (body.communities as CommunitySummary[]) ?? [],
      wallet,
      dbDegraded: Boolean(body.dbDegraded),
    };
  }, [user, query.data, query.error, query.isError]);

  const reload = useCallback(() => {
    void query.refetch();
  }, [query]);

  return (
    <ProfileBootstrapContext.Provider
      value={{ data, loading: query.isLoading && Boolean(user) && !data, reload }}
    >
      {children}
    </ProfileBootstrapContext.Provider>
  );
}

export function useProfileBootstrap() {
  return useContext(ProfileBootstrapContext);
}
