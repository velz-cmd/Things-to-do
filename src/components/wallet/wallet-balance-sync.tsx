"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";

const FAST_POLL_MS = 45_000;
const LIVE_POLL_MS = 90_000;

/**
 * Balance sync — Stripe-style: show ledger/cached balance immediately, refresh Arc RPC in background.
 */
export function WalletBalanceSync() {
  const { user, refreshBalance } = useAuth();
  const liveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fastTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    void refreshBalance({ mode: "fast", silent: true });
    const liveTimerId = window.setTimeout(() => {
      void refreshBalance({ mode: "live", silent: true });
    }, 400);

    fastTimer.current = setInterval(() => {
      void refreshBalance({ mode: "fast", silent: true });
    }, FAST_POLL_MS);

    liveTimer.current = setInterval(() => {
      void refreshBalance({ mode: "live", silent: true });
    }, LIVE_POLL_MS);

    return () => {
      window.clearTimeout(liveTimerId);
      if (fastTimer.current) clearInterval(fastTimer.current);
      if (liveTimer.current) clearInterval(liveTimer.current);
    };
  }, [user, refreshBalance]);

  return null;
}
