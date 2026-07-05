"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";

const POLL_MS = 25_000;

/** Keep Gmail/Google RESOLVE app wallet balance synced from Arc RPC across all tabs. */
export function AppWalletOnChainSync() {
  const { user, refreshBalance } = useAuth();

  useEffect(() => {
    if (!user) return;

    void refreshBalance();

    const timer = setInterval(() => {
      void refreshBalance();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [user, refreshBalance]);

  return null;
}
