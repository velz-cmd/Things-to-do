"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";

/** Provision Circle/deterministic Arc wallet immediately after email/Google sign-in. */
export function WalletProvisionEffect() {
  const { user, provisionWallet, refreshBalance } = useAuth();
  const ranForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      ranForUser.current = null;
      return;
    }
    if (ranForUser.current === user.id) return;
    ranForUser.current = user.id;

    void (async () => {
      try {
        await provisionWallet();
      } catch {
        /* provision is best-effort; balance refresh still runs */
      }
      await refreshBalance().catch(() => null);
    })();
  }, [user, provisionWallet, refreshBalance]);

  return null;
}
