"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";

const SNAPSHOT_POLL_MS = 60_000;

/**
 * Balance sync — Stripe-style: show ledger/cached balance immediately, refresh Arc RPC in background.
 */
export function WalletBalanceSync() {
  const { user, refreshBalance } = useAuth();

  useEffect(() => {
    if (!user) return;

    const refreshSnapshot = () => {
      if (document.visibilityState === "visible") {
        void refreshBalance({ mode: "fast", silent: true });
      }
    };
    refreshSnapshot();
    const timer = window.setInterval(refreshSnapshot, SNAPSHOT_POLL_MS);
    document.addEventListener("visibilitychange", refreshSnapshot);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshSnapshot);
    };
  }, [user, refreshBalance]);

  return null;
}
