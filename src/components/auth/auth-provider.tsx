"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
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

interface AuthContextValue {
  user: SupabaseUser | null;
  loading: boolean;
  balance: WalletBalance | null;
  balanceLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  resendEmailCode: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  provisionWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const refreshBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        setBalance(await res.json());
      }
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const provisionWallet = useCallback(async () => {
    const res = await fetch("/api/wallet/provision", { method: "POST" });
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
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          await fetch("/api/wallet/provision", { method: "POST" });
          await refreshBalance();
        } catch {
          /* provision may fail without server config */
        }
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
      toast.error("Sign-in not configured", {
        description: "Add Supabase URL and anon key in environment variables.",
      });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) toast.error("Google sign-in failed", { description: error.message });
  }, [supabase]);

  const signInWithEmail = useCallback(async (email: string) => {
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Could not send code", { description: data.error ?? "Try again" });
      throw new Error(data.error ?? "send failed");
    }
    toast.success("Code sent", {
      description: `Check ${email} for your 6-digit login code.`,
    });
  }, []);

  const resendEmailCode = useCallback(async (email: string) => {
    await signInWithEmail(email);
  }, [signInWithEmail]);

  const verifyEmailOtp = useCallback(
    async (email: string, token: string) => {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: token.replace(/\s/g, ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Invalid or expired code", {
          description: data.error ?? "Request a new code and try again.",
        });
        return false;
      }

      if (supabase) {
        await supabase.auth.refreshSession();
        const { data: sessionData } = await supabase.auth.getSession();
        setUser(sessionData.session?.user ?? null);
      }

      const isNew = Boolean(data.isNewUser);
      try {
        await fetch("/api/wallet/provision", { method: "POST", credentials: "include" });
        if (isNew) {
          await fetch("/api/auth/welcome-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, isNewUser: true }),
          });
        }
      } catch {
        /* non-blocking */
      }

      await refreshBalance();
      toast.success(isNew ? "Welcome to RESOLVE" : "Signed in");
      return true;
    },
    [supabase, refreshBalance]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setBalance(null);
    toast.success("Signed out");
  }, [supabase]);

  const value = useMemo(
    () => ({
      user,
      loading,
      balance,
      balanceLoading,
      signInWithGoogle,
      signInWithEmail,
      resendEmailCode,
      verifyEmailOtp,
      signOut,
      refreshBalance,
      provisionWallet,
    }),
    [
      user,
      loading,
      balance,
      balanceLoading,
      signInWithGoogle,
      signInWithEmail,
      resendEmailCode,
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
