"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { ProfileIdentityState } from "@/app/api/profile/identities/route";
import { embeddedWalletFor } from "@/lib/wallet/embedded";

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
      hint: "Install GitHub to claim code contributions",
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
      id: "listenbrainz",
      connected: false,
      hint: "Install MusicBrainz — one click",
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
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) {
      setData({ signedIn: false, email: null, emailVerified: false, identities: [], earnings: null, communities: [], wallet: null });
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetch("/api/profile/bootstrap", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        const wallet = body.wallet ?? offlineWalletForUser(user.id);
        if (!body.ok) {
          setData({
            signedIn: true,
            email: user.email ?? null,
            emailVerified: Boolean(user.email_confirmed_at ?? user.email),
            identities: body.identities?.length ? body.identities : offlineIdentitiesForUser(user.id),
            earnings: body.earnings ?? null,
            communities: body.communities ?? [],
            wallet,
            dbDegraded: true,
            error: body.error,
          });
          return;
        }
        setData({
          signedIn: true,
          email: body.email ?? user.email ?? null,
          emailVerified: Boolean(body.emailVerified ?? user.email),
          identities: body.identities ?? [],
          earnings: body.earnings ?? null,
          communities: body.communities ?? [],
          wallet,
          dbDegraded: Boolean(body.dbDegraded),
        });
      })
      .catch(() => {
        setData({
          signedIn: true,
          email: user.email ?? null,
          emailVerified: Boolean(user.email_confirmed_at ?? user.email),
          identities: offlineIdentitiesForUser(user.id),
          earnings: {
            signedIn: true,
            youEarnedUsd: 0,
            claimableUsd: 0,
            authorizedUsd: 0,
            settledUsd: 0,
            stalestClaimableAt: null,
            notifyUrgency: 0,
            githubLinked: false,
            identities: [],
          },
          communities: [],
          wallet: offlineWalletForUser(user.id),
          dbDegraded: true,
          error: "load_failed",
        });
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ProfileBootstrapContext.Provider value={{ data, loading, reload: load }}>
      {children}
    </ProfileBootstrapContext.Provider>
  );
}

export function useProfileBootstrap() {
  return useContext(ProfileBootstrapContext);
}
