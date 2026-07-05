"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { mergeArcBalanceSnapshot } from "@/lib/wallet/arc-balance-snapshot";
import { useResolveAccount } from "@/hooks/use-resolve-account";

const POLL_MS = 25_000;

/**
 * Background Arc balance sync — live RPC via Capital state, retains last-good on glitch.
 */
export function useArcBalancePoller(enabled = true) {
  const { user, refreshBalance } = useAuth();
  const account = useResolveAccount();
  const ticking = useRef(false);

  const poll = useCallback(async () => {
    if (!user || ticking.current) return;
    ticking.current = true;
    try {
      const res = await fetch("/api/capital/state", {
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(22_000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const slices = Array.isArray(data.walletSlices) ? data.walletSlices : [];
      const appSlice = slices.find((s: { kind: string }) => s.kind === "app");
      const extSlice = slices.find((s: { kind: string }) => s.kind === "external");
      const allowZero = data.syncStatus === "live";

      mergeArcBalanceSnapshot({
        appAddress: appSlice?.address ?? account.appWalletAddress ?? undefined,
        externalAddress: extSlice?.address ?? account.externalWalletAddress ?? undefined,
        appOnChainUsd: appSlice ? Number(appSlice.onChainUsd) : undefined,
        externalOnChainUsd: extSlice ? Number(extSlice.onChainUsd) : undefined,
        allowZero,
      });

      await refreshBalance().catch(() => null);
    } finally {
      ticking.current = false;
    }
  }, [user, refreshBalance, account.appWalletAddress, account.externalWalletAddress]);

  useEffect(() => {
    if (!enabled || !user) return;
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, user, poll]);

  return { poll };
}
