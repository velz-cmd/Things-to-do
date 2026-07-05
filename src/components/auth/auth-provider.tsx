"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  type EmailPasswordResult,
} from "@/lib/auth/email-password";
import { toast } from "sonner";
import { mergeArcBalanceSnapshot, readArcBalanceSnapshot } from "@/lib/wallet/arc-balance-snapshot";

export interface WalletBalance {
  availableUsd: number;
  onChainUsd: number | null;
  walletAddress?: string;
  appWalletAddress?: string;
  externalWalletAddress?: string;
  appOnChainUsd?: number | null;
  externalOnChainUsd?: number | null;
  appSpendableUsd?: number;
  externalSpendableUsd?: number;
  combinedOnChainUsd?: number | null;
  combinedSpendableUsd?: number;
  walletProvider?: "circle" | "embedded";
  syncStatus?: "live" | "cached" | "syncing" | "error" | "unknown" | "no_wallet";
  lastSyncedAt?: string | null;
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

export type { EmailPasswordResult } from "@/lib/auth/email-password";

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
  continueWithEmailPassword: (
    email: string,
    password: string
  ) => Promise<EmailPasswordResult>;
  requestPasswordReset: (
    email: string
  ) => Promise<
    { ok: true } | { ok: false; message: string; cooldownSeconds?: number }
  >;
  signOut: () => Promise<void>;
  refreshBalance: (opts?: { mode?: "fast" | "live"; silent?: boolean }) => Promise<void>;
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
  const balanceInflight = useRef<Map<string, Promise<void>>>(new Map());

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

  const refreshBalance = useCallback(async (opts?: { mode?: "fast" | "live"; silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const mode = opts?.mode ?? "fast";
    const inflightKey = mode;

    const pending = balanceInflight.current.get(inflightKey);
    if (pending) {
      await pending;
      return;
    }

    if (!silent) setBalanceLoading(true);

    const work = (async () => {
    try {
      const loadOnce = async (): Promise<boolean> => {
        const query = mode === "fast" ? "?fast=1" : "";
        const res = await fetch(`/api/capital/state${query}`, {
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(mode === "fast" ? 8_000 : 22_000),
        });
        const data = await res.json();
        let walletAddress =
          data.walletAddress ??
          data.wallet?.address ??
          null;

        if (!walletAddress && (data.code === "WALLET_NOT_FOUND" || data.syncStatus === "no_wallet")) {
          await fetch("/api/wallet/provision", {
            method: "POST",
            credentials: "include",
          }).catch(() => null);
          const retry = await fetch(`/api/capital/state${query}`, {
            credentials: "include",
            cache: "no-store",
            signal: AbortSignal.timeout(mode === "fast" ? 8_000 : 22_000),
          });
          const retryData = await retry.json();
          walletAddress =
            retryData.walletAddress ??
            retryData.wallet?.address ??
            null;
          if (!walletAddress) return false;
          Object.assign(data, retryData);
        }

        if (!walletAddress) {
          return false;
        }

        const slices = Array.isArray(data.walletSlices) ? data.walletSlices : [];
        const appSlice = slices.find((s: { kind: string }) => s.kind === "app");
        const extSlice = slices.find((s: { kind: string }) => s.kind === "external");
        const appWalletAddress =
          appSlice?.address ?? data.wallet?.address ?? walletAddress;
        const externalWalletAddress =
          extSlice?.address ?? data.wallet?.externalAddress ?? null;

        const appOnChainUsd = appSlice ? Number(appSlice.onChainUsd) : null;
        const externalOnChainUsd = extSlice ? Number(extSlice.onChainUsd) : null;
        const appSpendableUsd = appSlice ? Number(appSlice.spendableUsd) : null;
        const externalSpendableUsd = extSlice ? Number(extSlice.spendableUsd) : null;

        const onChainUsd = Number(
          data.usdcBalance ?? data.balance?.totalUsdc ?? data.balance?.onChainUsd ?? NaN,
        );
        const spendableFromChain = Number(
          data.spendableBalance ?? data.balance?.spendableUsd ?? NaN,
        );
        const ledgerSpendable = Number(data.lastKnownBalance ?? NaN);
        const live =
          data.syncStatus === "live" ||
          data.syncStatus === "cached" ||
          Number.isFinite(onChainUsd);

        const combinedSpendableUsd =
          live && Number.isFinite(spendableFromChain)
            ? spendableFromChain
            : live && Number.isFinite(onChainUsd)
              ? onChainUsd
              : Number.isFinite(ledgerSpendable)
                ? ledgerSpendable
                : 0;

        mergeArcBalanceSnapshot({
          appAddress: appWalletAddress ?? undefined,
          externalAddress: externalWalletAddress ?? undefined,
          appOnChainUsd: Number.isFinite(appOnChainUsd ?? NaN) ? appOnChainUsd! : undefined,
          externalOnChainUsd:
            Number.isFinite(externalOnChainUsd ?? NaN) ? externalOnChainUsd! : undefined,
          allowZero: data.syncStatus === "live",
        });

        setBalance({
          availableUsd: combinedSpendableUsd,
          onChainUsd: Number.isFinite(onChainUsd) ? onChainUsd : null,
          walletAddress: appWalletAddress,
          appWalletAddress,
          externalWalletAddress: externalWalletAddress ?? undefined,
          appOnChainUsd: Number.isFinite(appOnChainUsd ?? NaN) ? appOnChainUsd : null,
          externalOnChainUsd:
            Number.isFinite(externalOnChainUsd ?? NaN) ? externalOnChainUsd : null,
          appSpendableUsd:
            appSpendableUsd != null && Number.isFinite(appSpendableUsd)
              ? appSpendableUsd
              : undefined,
          externalSpendableUsd:
            externalSpendableUsd != null && Number.isFinite(externalSpendableUsd)
              ? externalSpendableUsd
              : undefined,
          combinedOnChainUsd: Number.isFinite(onChainUsd) ? onChainUsd : null,
          combinedSpendableUsd,
          walletProvider: data.walletProvider ?? data.wallet?.provider,
          syncStatus: data.syncStatus,
          lastSyncedAt: data.lastSyncedAt ?? data.balance?.syncedAt ?? null,
          lockedUsd: 0,
          releasedUsd: 0,
          recentActivity: Array.isArray(data.activity)
            ? data.activity.map(
                (tx: {
                  id: string;
                  label?: string;
                  amountUsd?: number | null;
                  createdAt?: string;
                  status?: string;
                  kind?: string;
                }) => ({
                  id: tx.id,
                  type: tx.kind ?? tx.status ?? "activity",
                  label: tx.label ?? null,
                  amountUsd: Number(tx.amountUsd ?? 0),
                  createdAt: tx.createdAt ?? new Date().toISOString(),
                }),
              )
            : Array.isArray(data.pendingTransactions)
            ? data.pendingTransactions.map(
                (tx: {
                  id: string;
                  label?: string;
                  amountUsd?: number;
                  createdAt?: string;
                  status?: string;
                }) => ({
                  id: tx.id,
                  type: tx.status ?? "pending",
                  label: tx.label ?? null,
                  amountUsd: Number(tx.amountUsd ?? 0),
                  createdAt: tx.createdAt ?? new Date().toISOString(),
                }),
              )
            : [],
        });
        return true;
      };

      const ok = await loadOnce();
      if (!ok) {
        setBalance((current) => current);
      }
    } catch {
      setBalance((current) => current);
    } finally {
      if (!silent) setBalanceLoading(false);
    }
    })();

    balanceInflight.current.set(inflightKey, work);
    try {
      await work;
    } finally {
      balanceInflight.current.delete(inflightKey);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }
    const snap = readArcBalanceSnapshot();
    const app = snap.appOnChainUsd;
    const ext = snap.externalOnChainUsd;
    if ((app != null && app >= 0) || (ext != null && ext >= 0)) {
      setBalance((current) => {
        if (current?.syncStatus === "live") return current;
        const combined = Math.round(((app ?? 0) + (ext ?? 0)) * 100) / 100;
        return {
          availableUsd: combined,
          onChainUsd: combined,
          walletAddress: snap.appAddress,
          appWalletAddress: snap.appAddress,
          externalWalletAddress: snap.externalAddress,
          appOnChainUsd: app ?? null,
          externalOnChainUsd: ext ?? null,
          combinedOnChainUsd: combined,
          combinedSpendableUsd: combined,
          syncStatus: "cached",
          lastSyncedAt: snap.updatedAt || null,
          lockedUsd: current?.lockedUsd ?? 0,
          releasedUsd: current?.releasedUsd ?? 0,
          recentActivity: current?.recentActivity ?? [],
        };
      });
    }
  }, [user?.id]);

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

  const continueWithEmail = useCallback(
    async (email: string, password: string): Promise<EmailPasswordResult> => {
      if (!emailEnabled) {
        return { ok: false, message: "Email sign-in is not available" };
      }

      try {
        const res = await fetch("/api/auth/email-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(20_000),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          suggestForgotPassword?: boolean;
          isNewUser?: boolean;
        };

        if (!res.ok) {
          return {
            ok: false,
            message: String(data.error ?? "Could not sign in. Try again."),
            suggestForgotPassword: data.suggestForgotPassword,
          };
        }

        setRememberedEmail(email.trim().toLowerCase());
        setRememberedProvider("email");

        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        }

        return { ok: true, isNewUser: data.isNewUser };
      } catch (e) {
        if (e instanceof Error && e.name === "TimeoutError") {
          return { ok: false, message: "Sign-in timed out. Try again." };
        }
        return { ok: false, message: "Could not sign in. Try again." };
      }
    },
    [emailEnabled, supabase],
  );

  const requestPasswordResetEmail = useCallback(
    async (email: string) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        return { ok: false as const, message: "Enter your email address." };
      }

      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
          signal: AbortSignal.timeout(15_000),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          cooldownSeconds?: number;
        };
        if (!res.ok) {
          const raw = String(data.error ?? "Could not send reset link.");
          const message =
            /prisma|invocation|does not exist/i.test(raw)
              ? "Could not send reset link right now. Try again in a minute."
              : raw;
          return {
            ok: false as const,
            message,
            cooldownSeconds: data.cooldownSeconds,
          };
        }
        return { ok: true as const };
      } catch {
        return { ok: false as const, message: "Could not send reset link." };
      }
    },
    []
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
      continueWithEmailPassword: continueWithEmail,
      requestPasswordReset: requestPasswordResetEmail,
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
      continueWithEmail,
      requestPasswordResetEmail,
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
