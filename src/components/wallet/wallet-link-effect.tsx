"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";

/** Sync connected Reown wallet to the signed-in RESOLVE profile. */
export function WalletLinkEffect() {
  const { address, isConnected } = useAccount();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isConnected || !address) return;

    void fetch("/api/wallet/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address }),
    }).catch(() => {
      /* non-fatal */
    });
  }, [user, isConnected, address]);

  return null;
}
