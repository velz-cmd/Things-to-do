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
  | { ok: true; method?: "otp" | "magic_link"; alreadySent?: boolean }
  | { ok: false; cooldownSeconds?: number; message: string };

export type VerifyOtpResult =
  | { ok: true; walletPending?: boolean }
  | { ok: false; message: string };

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
  balance: WalletBalance | null;
  balanceLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<EmailSendResult>;
  sendLoginCode: (email: string) => Promise<EmailSendResult>;
  verifyEmailOtp: (email: string, code: string) => Promise<VerifyOtpResult>;
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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void fetch("/api/wallet/provision", {
          method: "POST",
          credentials: "include",
        })
          .then(() => refreshBalance())
          .catch(() => {
            /* non-fatal */
          });
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

      return { ok: true, method: "magic_link" };
    },
    [supabase, emailEnabled]
  );

  const sendLoginCode = useCallback(
    async (email: string): Promise<EmailSendResult> => {
      const trimmed = email.trim().toLowerCase();

      if (capabilities.emailMagicLink && supabase) {
        const magic = await signInWithEmail(trimmed);
        if (magic.ok) return magic;
        if (magic.cooldownSeconds) {
          return {
            ok: true,
            method: "magic_link",
            alreadySent: true,
          };
        }
      }

      if (capabilities.emailOtp) {
        try {
          const res = await withTimeout(
            fetch("/api/auth/send-code", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: trimmed }),
            }),
            15_000
          );
          const data = await res.json().catch(() => ({}));

          if (res.ok) {
            return { ok: true, method: "otp" };
          }

          const msg = String(data.error ?? "Could not send code");
          const cooldownSeconds = parseOtpCooldown(msg);
          if (
            res.status === 429 ||
            cooldownSeconds !== undefined ||
            msg.toLowerCase().includes("wait") ||
            msg.toLowerCase().includes("security")
          ) {
            return {
              ok: true,
              method: "otp",
              alreadySent: true,
            };
          }
        } catch (e) {
          if (e instanceof Error && e.message === "timeout") {
            return { ok: false, message: "Email send timed out. Try again." };
          }
        }
      }

      if (capabilities.emailMagicLink && supabase) {
        return signInWithEmail(trimmed);
      }

      return { ok: false, message: "Email sign-in is not available" };
    },
    [
      capabilities.emailOtp,
      capabilities.emailMagicLink,
      supabase,
      signInWithEmail,
    ]
  );

  const verifyEmailOtp = useCallback(
    async (email: string, code: string): Promise<VerifyOtpResult> => {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          ok: false,
          message: String(data.error ?? "Invalid or expired code."),
        };
      }

      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        setSession(sessionData.session);
        setUser(sessionData.session?.user ?? null);
      }

      let walletPending = false;
      try {
        const walletRes = await fetch("/api/account/app-wallet/create", {
          method: "POST",
          credentials: "include",
        });
        const walletData = await walletRes.json().catch(() => ({}));
        walletPending = walletData.status === "wallet_pending";
        if (walletRes.ok && !walletPending) {
          await refreshBalance();
        }
      } catch {
        walletPending = true;
      }

      return { ok: true, walletPending };
    },
    [supabase, refreshBalance]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
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
      balance,
      balanceLoading,
      signInWithGoogle,
      signInWithEmail,
      sendLoginCode,
      verifyEmailOtp,
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
      balance,
      balanceLoading,
      signInWithGoogle,
      signInWithEmail,
      sendLoginCode,
      verifyEmailOtp,
      signOut,
      refreshBalance,
      provisionWallet,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { isSupabaseConfigured };
