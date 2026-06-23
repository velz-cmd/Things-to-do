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
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        toast.error("Email sign-in failed", { description: error.message });
      } else {
        toast.success("Check your email", {
          description: "We sent a secure sign-in link.",
        });
      }
    },
    [supabase]
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
