"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { toast } from "sonner";
import { arcTestnet } from "@/lib/arc/config";
import { usdcToWei } from "@/lib/arc/utils";
import { ensureArcNetwork, isArcChain } from "@/lib/arc/wallet";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useConnectedArcBalance } from "@/hooks/use-connected-arc-balance";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import { isWalletConnectEnabled } from "@/lib/reown/config";

export function useWalletActions() {
  const { user, refreshBalance } = useAuth();
  const account = useResolveAccount();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync } = useSwitchChain();
  const { open } = useAppKit();
  const connectedBalance = useConnectedArcBalance();
  const depositAddressRef = useRef<string | null>(null);
  const signingRef = useRef(false);

  const { sendTransactionAsync, isPending } = useSendTransaction();

  const linkedExternal = account.externalWalletAddress?.toLowerCase();
  const connectedAddr = address?.toLowerCase();
  const walletLinked =
    Boolean(linkedExternal) && Boolean(connectedAddr) && linkedExternal === connectedAddr;

  const canPayWithConnectedWallet =
    isWalletConnectEnabled() && isConnected && walletLinked && Boolean(user);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/banking/account", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const addr =
          data?.arc?.identityWallet?.depositAddress ?? data?.walletAddress ?? null;
        if (addr) depositAddressRef.current = addr;
      })
      .catch(() => {
        /* optional */
      });
  }, [user]);

  useEffect(() => {
    if (account.appWalletAddress) {
      depositAddressRef.current = account.appWalletAddress;
    }
  }, [account.appWalletAddress]);

  const ensureArc = useCallback(async () => {
    await ensureArcNetwork();
    if (!isArcChain(chainId)) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }
  }, [chainId, switchChainAsync]);

  const openConnectWallet = useCallback(() => {
    open({ view: "Connect" });
  }, [open]);

  const fundProgramWithWallet = useCallback(
    async (programId: string, amountUsd: number): Promise<void> => {
      if (!canPayWithConnectedWallet || !address) {
        throw new Error("Connect your Arc wallet from the account menu first");
      }

      if (connectedBalance.usdc < amountUsd) {
        throw new Error(
          `Insufficient wallet balance: $${connectedBalance.usdc.toFixed(2)} on Arc, need $${amountUsd.toFixed(2)}`,
        );
      }

      const depositAddress = depositAddressRef.current ?? account.appWalletAddress;
      if (!depositAddress) {
        throw new Error("RESOLVE wallet not ready — wait a moment and retry");
      }

      if (signingRef.current) {
        throw new Error("Wallet transaction already in progress");
      }

      signingRef.current = true;
      try {
        await ensureArc();

        toast.loading("Confirm in your wallet…", { id: "wallet-fund" });

        const hash = await sendTransactionAsync({
          chainId: arcTestnet.id,
          to: depositAddress as `0x${string}`,
          value: usdcToWei(amountUsd),
        });

        toast.loading("Confirming on Arc…", { id: "wallet-fund" });

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        const res = await fetch("/api/capital/fund-with-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ programId, amountUsd, txHash: hash }),
        });
        const data = await parseJsonResponse<{ error?: string; message?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Fund failed after on-chain transfer");

        toast.success(data.message ?? `Pool funded with $${amountUsd.toFixed(2)} USDC`, {
          id: "wallet-fund",
        });

        await refreshBalance().catch(() => null);
        connectedBalance.refetch();
      } catch (e) {
        toast.dismiss("wallet-fund");
        throw e;
      } finally {
        signingRef.current = false;
      }
    },
    [
      canPayWithConnectedWallet,
      address,
      connectedBalance,
      account.appWalletAddress,
      ensureArc,
      sendTransactionAsync,
      publicClient,
      refreshBalance,
    ],
  );

  return {
    canPayWithConnectedWallet,
    connectedBalanceUsd: connectedBalance.usdc,
    balanceLoaded: connectedBalance.loaded,
    walletSigning: isPending,
    spendableUsd: canPayWithConnectedWallet ? connectedBalance.usdc : undefined,
    fundProgramWithWallet,
    openConnectWallet,
    ensureArc,
  };
}
