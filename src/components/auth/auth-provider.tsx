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
  markGoogleAuthBroken,
} from "@/hooks/use-auth-capabilities";
import { syncLocalMemoryToServer } from "@/lib/auth/memory-sync";
import { syncLocalEcosystemsToServer, clearGuestSessionStorage } from "@/lib/auth/ecosystem-sync";
import {
  setRememberedEmail,
  setRememberedProvider,
} from "@/lib/auth/remember";
import { toast } from "sonner";

export interface WalletBalance {
  availableUsd: number;
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

export type EmailSendResult =
  | {
      ok: true;
      expiresInMinutes?: number;
      resendCooldownSeconds?: number;
    }
  | { ok: false; cooldownSeconds?: number; message: string };

function parseOtpCooldown(message: string): number | undefined {
  const match = message.match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : undefined;
}

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
  signInWithEmail: (email: string) => Promise<EmailSendResult>;
  sendLoginCode: (email: string) => Promise<EmailSendResult>;
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
      const res = await fetch("/api/wallet/balance", { credentials: "include" });
      if (res.ok) {
        setBalance(await res.json());
      }
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

        void fetch("/api/wallet/provision", {
          method: "POST",
          credentials: "include",
        })
          .then(() => refreshBalance())
          .catch(() => {
            /* non-fatal */
          });
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
    if (!supabase || !googleEnabled) {
      throw new Error("Google sign-in is not available");
    }
    const { error } = await withTimeout(
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "openid email profile",
        },
      }),
      10_000
    );
    if (error) {
      if (
        error.message.includes("redirect") ||
        error.message.includes("OAuth")
      ) {
        markGoogleAuthBroken();
      }
      throw error;
    }
  }, [supabase, googleEnabled]);

  const signInWithGitHub = useCallback(async () => {
    if (!supabase || !githubEnabled) {
      throw new Error("GitHub sign-in is not available");
    }
    const { error } = await withTimeout(
      supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
          scopes: "read:user",
        },
      }),
      10_000,
    );
    if (error) throw error;
  }, [supabase, githubEnabled]);

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

  const signInWithEmail = useCallback(
    async (email: string): Promise<EmailSendResult> => {
      if (!supabase || !emailEnabled) {
        return { ok: false, message: "Email sign-in is not available" };
      }

      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        }),
        15_000
      );

      if (error) {
        const cooldownSeconds = parseOtpCooldown(error.message);
        if (cooldownSeconds !== undefined) {
          return {
            ok: false,
            cooldownSeconds,
            message: `Magic link already sent. Try again in ${cooldownSeconds} seconds.`,
          };
        }
        return { ok: false, message: error.message };
      }

      return { ok: true };
    },
    [supabase, emailEnabled]
  );

  const sendLoginCode = useCallback(
    async (email: string): Promise<EmailSendResult> => {
      const trimmed = email.trim().toLowerCase();

      if (!emailEnabled) {
        return { ok: false, message: "Email sign-in is not available" };
      }

      try {
        const res = await withTimeout(
          fetch("/api/auth/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: trimmed }),
          }),
          20_000
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          cooldownSeconds?: number;
          clientSend?: boolean;
          expiresInMinutes?: number;
          resendCooldownSeconds?: number;
        };

        if (!res.ok) {
          const cooldownSeconds =
            data.cooldownSeconds ?? parseOtpCooldown(String(data.error ?? ""));
          const message = String(data.error ?? "Could not send sign-in link.");

          return {
            ok: false,
            cooldownSeconds,
            message,
          };
        }

        if (!supabase) {
          return { ok: false, message: "Email sign-in is not available" };
        }

        const { error } = await withTimeout(
          supabase.auth.signInWithOtp({
            email: trimmed,
            options: {
              shouldCreateUser: true,
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          }),
          15_000
        );

        if (error) {
          const cooldownSeconds = parseOtpCooldown(error.message);
          return {
            ok: false,
            cooldownSeconds,
            message: error.message,
          };
        }

        await fetch("/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, confirm: true }),
        }).catch(() => {
          /* non-fatal */
        });

        return {
          ok: true,
          expiresInMinutes: data.expiresInMinutes ?? 5,
          resendCooldownSeconds: data.resendCooldownSeconds ?? 60,
        };
      } catch (e) {
        if (e instanceof Error && e.message === "timeout") {
          return { ok: false, message: "Email send timed out. Try again." };
        }
        return { ok: false, message: "Could not send sign-in email." };
      }
    },
    [emailEnabled, supabase]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    clearGuestSessionStorage();
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
      signInWithEmail,
      sendLoginCode,
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
      signInWithEmail,
      sendLoginCode,
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
