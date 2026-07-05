"use client";

import { useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useAuth } from "@/components/auth/auth-provider";
import { WALLET_LINKED_EVENT } from "@/components/wallet/wallet-link-effect";
import { arcTestnet } from "@/lib/arc/config";
import { ensureArcNetwork, isArcChain } from "@/lib/arc/wallet";
import { isWalletConnectEnabled } from "@/lib/reown/config";
import { useConnectedArcBalance } from "@/hooks/use-connected-arc-balance";

const SYNC_INTERVAL_MS = 45_000;

/** Keep linked external wallet on Arc and sync on-chain USDC to the server ledger. */
export function ConnectedWalletSync() {
  const { user, refreshBalance } = useAuth();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { refetch } = useConnectedArcBalance();
  const lastSyncRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isWalletConnectEnabled() || !user || !isConnected || !address) return;

    let cancelled = false;

    async function sync() {
      try {
        if (!isArcChain(chainId)) {
          await ensureArcNetwork().catch(() => null);
          if (!isArcChain(chainId)) {
            await switchChainAsync({ chainId: arcTestnet.id }).catch(() => null);
          }
        }

        const res = await fetch("/api/wallet/sync-connected", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ walletAddress: address }),
        });

        if (!cancelled && res.ok && address && lastSyncRef.current !== address) {
          lastSyncRef.current = address;
          await refreshBalance({ mode: "fast", silent: true });
        }
      } catch {
        /* non-fatal */
      }
    }

    void sync();
    const timer = setInterval(() => {
      refetch();
      void sync();
    }, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, isConnected, address, chainId, switchChainAsync, refreshBalance, refetch]);

  useEffect(() => {
    if (!user) return;

    function onLinked() {
      void refreshBalance({ mode: "live", silent: false });
      refetch();
    }

    window.addEventListener(WALLET_LINKED_EVENT, onLinked);
    return () => window.removeEventListener(WALLET_LINKED_EVENT, onLinked);
  }, [user, refreshBalance, refetch]);

  return null;
}
