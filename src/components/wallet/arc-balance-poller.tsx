"use client";

import { useArcBalancePoller } from "@/hooks/use-arc-balance-poller";
import { useAuth } from "@/components/auth/auth-provider";

/** Polls Arc on-chain balances for app + linked external wallets. */
export function ArcBalancePoller() {
  const { user } = useAuth();
  useArcBalancePoller(Boolean(user));
  return null;
}
