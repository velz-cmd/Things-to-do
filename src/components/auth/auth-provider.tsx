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

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) {
        toast.error("Sign-in not configured");
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        toast.error("Could not send code", { description: error.message });
        throw error;
      }
    },
    [supabase]
  );

  const verifyEmailOtp = useCallback(
    async (email: string, token: string) => {
      if (!supabase) {
        toast.error("Sign-in not configured");
        return false;
      }
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: token.replace(/\s/g, ""),
        type: "email",
      });
      if (error) {
        toast.error("Invalid or expired code", { description: error.message });
        return false;
      }
      if (data.user) {
        const isNew =
          data.user.created_at &&
          Date.now() - new Date(data.user.created_at).getTime() < 120_000;
        try {
          await fetch("/api/wallet/provision", { method: "POST" });
          await fetch("/api/auth/welcome-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: data.user.email,
              name:
                data.user.user_metadata?.full_name ??
                data.user.user_metadata?.name,
              isNewUser: isNew,
            }),
          });
        } catch {
          /* non-blocking */
        }
        await refreshBalance();
        toast.success(isNew ? "Account activated" : "Signed in");
        return true;
      }
      return false;
    },
    [supabase, refreshBalance]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
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
