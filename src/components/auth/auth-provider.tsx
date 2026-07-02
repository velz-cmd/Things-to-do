"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Session, User as SupabaseUser, SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  tryCreateSupabaseBrowserClient,
} from "@/lib/supabase/client";
import {
  useAuthCapabilities,
} from "@/hooks/use-auth-capabilities";
import { syncLocalMemoryToServer } from "@/lib/auth/memory-sync";
import { syncLocalEcosystemsToServer, clearGuestSessionStorage } from "@/lib/auth/ecosystem-sync";
import { clearSignInFlowState } from "@/lib/auth/sign-in-storage";
import {
  setRememberedEmail,
  setRememberedProvider,
} from "@/lib/auth/remember";
import { toast } from "sonner";

export interface WalletBalance {
  availableUsd: number;
  onChainUsd: number | null;
  walletAddress?: string;
  walletProvider?: "circle" | "embedded";
  lockedUsd: number;
  releasedUsd: number;
  recentActivity: {
    id: string;
    type: string;
    label: string | null;
    amountUsd: number;
    createdAt: string;
  }[];
}

export type EmailPasswordResult =
  | { ok: true; isNewUser?: boolean }
  | { ok: false; message: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

interface AuthContextValue {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  supabaseConfigured: boolean;
  emailEnabled: boolean;
  googleEnabled: boolean;
  githubEnabled: boolean;
  balance: WalletBalance | null;
  balanceLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  linkGitHub: () => Promise<void>;
  signInWithEmailPassword: (
    email: string,
    password: string
  ) => Promise<EmailPasswordResult>;
  signUpWithEmailPassword: (
    email: string,
    password: string
  ) => Promise<EmailPasswordResult>;
  signOut: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  provisionWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const capabilities = useAuthCapabilities();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(() =>
    tryCreateSupabaseBrowserClient()
  );
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const supabaseConfigured =
    capabilities.supabase ||
    isSupabaseConfigured() ||
    Boolean(capabilities.publicConfig);
  const emailEnabled = capabilities.email;
  const googleEnabled = capabilities.google;
  const githubEnabled = capabilities.github;

  useEffect(() => {
    if (supabase) return;
    if (!capabilities.publicConfig) return;
    setSupabase(
      createBrowserClient(
        capabilities.publicConfig.url,
        capabilities.publicConfig.anonKey
      )
    );
  }, [supabase, capabilities.publicConfig]);

  const refreshBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await fetch("/api/capital/wallet", {
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
      const data = await res.json();
      if (data.ok && data.balance) {
        setBalance({
          availableUsd: Number(data.balance.spendableUsd),
          onChainUsd: Number(data.balance.onChainUsd ?? data.balance.totalUsdc),
          walletAddress: data.wallet?.address,
          walletProvider: data.wallet?.provider,
          lockedUsd: 0,
          releasedUsd: 0,
          recentActivity: [],
        });
      } else {
        setBalance(null);
      }
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const provisionWallet = useCallback(async () => {
    const res = await fetch("/api/wallet/provision", {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Wallet setup failed");
    await refreshBalance();
    return data;
  }, [refreshBalance]);

  useEffect(() => {
    if (!capabilities.loaded) return;

    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        const userId = nextSession.user.id;
        try {
          const lastUserId = sessionStorage.getItem("resolve.auth.lastUserId");
          if (lastUserId && lastUserId !== userId) {
            clearGuestSessionStorage();
          }
          sessionStorage.setItem("resolve.auth.lastUserId", userId);
        } catch {
          /* ignore */
        }

        const email = nextSession.user.email?.trim().toLowerCase();
        if (email) {
          setRememberedEmail(email);
          const provider =
            nextSession.user.app_metadata?.provider === "google"
              ? "google"
              : nextSession.user.app_metadata?.provider === "github"
                ? "github"
              : nextSession.user.app_metadata?.provider === "email"
                ? "email"
                : "email";
          setRememberedProvider(provider);
        }

        void syncLocalMemoryToServer().catch(() => {
          /* non-fatal */
        });

        void syncLocalEcosystemsToServer(userId).catch(() => {
          /* non-fatal */
        });

        // Defer wallet DB writes — profile bootstrap handles display; avoids pool storms on sign-in.
        window.setTimeout(() => {
          void fetch("/api/wallet/provision", {
            method: "POST",
            credentials: "include",
          })
            .then(() => refreshBalance())
            .catch(() => {
              /* non-fatal */
            });
        }, 12_000);
      } else if (event === "SIGNED_OUT") {
        setBalance(null);
      } else {
        setBalance(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, capabilities.loaded, refreshBalance]);

  useEffect(() => {
    if (user) void refreshBalance();
  }, [user, refreshBalance]);

  const signInWithGoogle = useCallback(async () => {
    if (!googleEnabled) {
      throw new Error("Google sign-in is not available");
    }
    window.location.assign("/api/auth/oauth/google");
  }, [googleEnabled]);

  const signInWithGitHub = useCallback(async () => {
    if (!githubEnabled) {
      throw new Error("GitHub sign-in is not available");
    }
    window.location.assign("/api/auth/oauth/github?next=/profile");
  }, [githubEnabled]);

  const linkGitHub = useCallback(async () => {
    if (!supabase || !githubEnabled) {
      throw new Error("GitHub linking is not available");
    }
    const { error } = await withTimeout(
      supabase.auth.linkIdentity({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/profile%3Fgithub_linked%3D1`,
          scopes: "read:user",
        },
      }),
      10_000,
    );
    if (error) {
      if (error.message.includes("already linked") || error.message.includes("Manual linking")) {
        await signInWithGitHub();
        return;
      }
      throw error;
    }
  }, [supabase, githubEnabled, signInWithGitHub]);

function mapPasswordAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Wrong email or password.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email first, or ask an admin to disable email confirmation in Supabase.";
  }
  if (lower.includes("signup is disabled")) {
    return "New sign-ups are disabled. Contact support.";
  }
  return message;
}

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string): Promise<EmailPasswordResult> => {
      if (!emailEnabled) {
        return { ok: false, message: "Email sign-in is not available" };
      }
      if (!supabase) {
        return { ok: false, message: "Auth is not configured" };
      }

      const trimmed = email.trim().toLowerCase();
      if (!trimmed || password.length < 6) {
        return {
          ok: false,
          message: "Enter a valid email and password (6+ characters).",
        };
      }

      try {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email: trimmed, password }),
          15_000
        );
        if (error) {
          return { ok: false, message: mapPasswordAuthError(error.message) };
        }
        setRememberedEmail(trimmed);
        setRememberedProvider("email");
        return { ok: true };
      } catch (e) {
        if (e instanceof Error && e.message === "timeout") {
          return { ok: false, message: "Sign-in timed out. Try again." };
        }
        return { ok: false, message: "Could not sign in. Try again." };
      }
    },
    [emailEnabled, supabase]
  );

  const signUpWithEmailPassword = useCallback(
    async (email: string, password: string): Promise<EmailPasswordResult> => {
      if (!emailEnabled) {
        return { ok: false, message: "Email sign-up is not available" };
      }
      if (!supabase) {
        return { ok: false, message: "Auth is not configured" };
      }

      const trimmed = email.trim().toLowerCase();
      if (!trimmed || password.length < 6) {
        return {
          ok: false,
          message: "Enter a valid email and password (6+ characters).",
        };
      }

      try {
        const { data, error } = await withTimeout(
          supabase.auth.signUp({ email: trimmed, password }),
          15_000
        );
        if (error) {
          return { ok: false, message: mapPasswordAuthError(error.message) };
        }

        if (data.session) {
          setRememberedEmail(trimmed);
          setRememberedProvider("email");
          return { ok: true, isNewUser: true };
        }

        // Supabase may require email confirmation before session is issued.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (!signInError && data.user) {
          setRememberedEmail(trimmed);
          setRememberedProvider("email");
          return { ok: true, isNewUser: true };
        }

        return {
          ok: false,
          message:
            "Account created. Disable “Confirm email” in Supabase Auth settings for instant sign-in, or check your inbox to confirm.",
        };
      } catch (e) {
        if (e instanceof Error && e.message === "timeout") {
          return { ok: false, message: "Sign-up timed out. Try again." };
        }
        return { ok: false, message: "Could not create account. Try again." };
      }
    },
    [emailEnabled, supabase]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    clearGuestSessionStorage();
    clearSignInFlowState();
    try {
      sessionStorage.removeItem("resolve.auth.lastUserId");
    } catch {
      /* ignore */
    }
    setSession(null);
    setUser(null);
    setBalance(null);
    toast.success("Signed out");
  }, [supabase]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading: loading && capabilities.loaded,
      supabaseConfigured,
      emailEnabled,
      googleEnabled,
      githubEnabled,
      balance,
      balanceLoading,
      signInWithGoogle,
      signInWithGitHub,
      linkGitHub,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signOut,
      refreshBalance,
      provisionWallet,
    }),
    [
      user,
      session,
      loading,
      capabilities.loaded,
      supabaseConfigured,
      emailEnabled,
      googleEnabled,
      githubEnabled,
      balance,
      balanceLoading,
      signInWithGoogle,
      signInWithGitHub,
      linkGitHub,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signOut,
      refreshBalance,
      provisionWallet,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { isSupabaseConfigured };
