"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  tryCreateSupabaseBrowserClient,
} from "@/lib/supabase/client";
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
  | { ok: true; method?: "otp" | "magic_link" }
  | { ok: false; cooldownSeconds?: number; message: string };

export type VerifyOtpResult =
  | { ok: true; walletPending?: boolean }
  | { ok: false; message: string };

function parseOtpCooldown(message: string): number | undefined {
  const match = message.match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : undefined;
}

function authConfigError(): string {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return "Authentication is not configured. Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  }
  return "Sign-in is temporarily unavailable. Please try again later.";
}

interface AuthContextValue {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  supabaseConfigured: boolean;
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
  const supabase = useMemo(() => tryCreateSupabaseBrowserClient(), []);
  const supabaseConfigured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

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
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
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
            /* provision may fail without server config */
          });
      } else {
        setBalance(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshBalance]);

  useEffect(() => {
    if (user) void refreshBalance();
  }, [user, refreshBalance]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      toast.error(authConfigError());
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile",
      },
    });
    if (error) toast.error("Google sign-in failed", { description: error.message });
  }, [supabase]);

  const signInWithEmail = useCallback(
    async (email: string): Promise<EmailSendResult> => {
      if (!supabase) {
        return { ok: false, message: authConfigError() };
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

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
    [supabase]
  );

  const sendLoginCode = useCallback(
    async (email: string): Promise<EmailSendResult> => {
      const trimmed = email.trim().toLowerCase();
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = String(data.error ?? "Could not send code");
        if (res.status === 429 || msg.toLowerCase().includes("wait")) {
          const cooldownSeconds = parseOtpCooldown(msg) ?? 60;
          return {
            ok: false,
            cooldownSeconds,
            message: `Code already sent. Try again in ${cooldownSeconds} seconds.`,
          };
        }
        if (res.status === 503) {
          return signInWithEmail(trimmed);
        }
        return { ok: false, message: msg };
      }

      return { ok: true, method: "otp" };
    },
    [signInWithEmail]
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
      loading,
      supabaseConfigured,
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
      supabaseConfigured,
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
