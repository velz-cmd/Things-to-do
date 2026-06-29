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

type CommunitySummary = { slug: string; name: string; installed: boolean };

type BootstrapData = {
  signedIn: boolean;
  email: string | null;
  emailVerified: boolean;
  identities: ProfileIdentityState[];
  earnings: Record<string, unknown> | null;
  communities: CommunitySummary[];
  wallet: { address: string; embedded: boolean; provider: string } | null;
  error?: string;
};

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
        if (!body.ok) {
          setData({
            signedIn: true,
            email: user.email ?? null,
            emailVerified: false,
            identities: [],
            earnings: null,
            communities: [],
            wallet: null,
            error: body.error,
          });
          return;
        }
        setData({
          signedIn: true,
          email: body.email ?? null,
          emailVerified: Boolean(body.emailVerified),
          identities: body.identities ?? [],
          earnings: body.earnings ?? null,
          communities: body.communities ?? [],
          wallet: body.wallet ?? null,
        });
      })
      .catch(() => {
        setData({
          signedIn: true,
          email: user.email ?? null,
          emailVerified: false,
          identities: [],
          earnings: null,
          communities: [],
          wallet: null,
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
