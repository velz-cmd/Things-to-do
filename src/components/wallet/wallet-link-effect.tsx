"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";

export const WALLET_LINKED_EVENT = "resolve.wallet.linked";

/** Sync connected Reown wallet to the signed-in RESOLVE profile. */
export function WalletLinkEffect() {
  const { address, isConnected } = useAccount();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isConnected || !address) return;

    void fetch("/api/wallet/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ walletAddress: address }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        window.dispatchEvent(new Event(WALLET_LINKED_EVENT));
        const toastKey = `resolve.wallet.linked.${address.toLowerCase()}`;
        if (!sessionStorage.getItem(toastKey)) {
          sessionStorage.setItem(toastKey, "1");
          toast.success("External wallet linked — your RESOLVE wallet is unchanged");
        }
      })
      .catch(() => {
        /* non-fatal */
      });
  }, [user, isConnected, address]);

  return null;
}
