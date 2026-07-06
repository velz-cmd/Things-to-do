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
import { mutationFetch } from "@/lib/api/mutation-fetch";
import type { FundProgressStage } from "@/lib/capital/fund-progress";

export type WalletFundResult = { txHash: string; activityId?: string };

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

  const externalConnected =
    isWalletConnectEnabled() && isConnected && Boolean(connectedAddr) && Boolean(user);

  const walletLinked =
    Boolean(linkedExternal) &&
    Boolean(connectedAddr) &&
    linkedExternal === connectedAddr;

  const canPayWithConnectedWallet = externalConnected && (walletLinked || !linkedExternal);

  useEffect(() => {
    depositAddressRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/capital/payment-route?action=deposit", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok && data.address) {
          depositAddressRef.current = data.address;
        }
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

  const ensureExternalLinked = useCallback(async (): Promise<boolean> => {
    if (!connectedAddr) return false;
    if (walletLinked) return true;

    const res = await fetch("/api/wallet/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ walletAddress: connectedAddr }),
    });
    return res.ok;
  }, [connectedAddr, walletLinked]);

  const openConnectWallet = useCallback(() => {
    open({ view: "Connect" });
  }, [open]);

  const fundProgramWithWallet = useCallback(
    async (
      programId: string,
      amountUsd: number,
      opts?: {
        onStage?: (stage: FundProgressStage, txHash?: string) => void;
      },
    ): Promise<WalletFundResult> => {
      if (!externalConnected || !address) {
        throw new Error("Connect your wallet from Profile or the account menu");
      }

      if (linkedExternal && connectedAddr && linkedExternal !== connectedAddr) {
        throw new Error(
          "Connected wallet does not match your linked address — reconnect or change wallet in Profile",
        );
      }

      if (connectedBalance.usdc < amountUsd) {
        throw new Error(
          `Insufficient connected wallet balance: $${connectedBalance.usdc.toFixed(2)} on Arc, need $${amountUsd.toFixed(2)}`,
        );
      }

      const routeRes = await fetch("/api/capital/payment-route?action=program_fund", {
        credentials: "include",
      });
      const route = await parseJsonResponse<{
        ok?: boolean;
        address?: string;
        label?: string;
        error?: string;
      }>(routeRes);
      if (!routeRes.ok || !route.ok || !route.address) {
        throw new Error(route.error ?? "Could not resolve treasury destination");
      }

      const depositAddress = route.address;

      if (signingRef.current) {
        throw new Error("Wallet transaction already in progress");
      }

      signingRef.current = true;
      try {
        opts?.onStage?.("checking_wallet");

        const linked = await ensureExternalLinked();
        if (!linked) {
          throw new Error("Could not link wallet to your account — try again from Profile");
        }

        await ensureArc();
        opts?.onStage?.("awaiting_signature");

        toast.message(`Sign to send $${amountUsd.toFixed(2)} USDC to ${route.label ?? "settlement treasury"}`, {
          id: "wallet-fund",
        });

        const hash = await sendTransactionAsync({
          chainId: arcTestnet.id,
          to: depositAddress as `0x${string}`,
          value: usdcToWei(amountUsd),
        });

        opts?.onStage?.("arc_broadcast", hash);
        opts?.onStage?.("arc_confirming", hash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        opts?.onStage?.("recording_stake", hash);

        let data: { error?: string; message?: string; activityId?: string } = {};
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await mutationFetch("/api/capital/fund-with-tx", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ programId, amountUsd, txHash: hash }),
            });
            data = await parseJsonResponse(res);
            if (!res.ok) throw new Error(data.error ?? "Fund failed after on-chain transfer");
            lastError = null;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error("Fund failed after on-chain transfer");
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
            }
          }
        }
        if (lastError) {
          throw new Error(
            `${lastError.message} Your on-chain USDC was sent — open Capital to retry recording, or contact support with tx ${hash.slice(0, 10)}…`,
          );
        }

        toast.success(data.message ?? `Pool funded with $${amountUsd.toFixed(2)} USDC`, {
          id: "wallet-fund",
        });

        await refreshBalance().catch(() => null);
        connectedBalance.refetch();
        return { txHash: hash, activityId: data.activityId };
      } catch (e) {
        toast.dismiss("wallet-fund");
        throw e;
      } finally {
        signingRef.current = false;
      }
    },
    [
      externalConnected,
      address,
      linkedExternal,
      connectedAddr,
      connectedBalance,
      account.appWalletAddress,
      ensureArc,
      ensureExternalLinked,
      sendTransactionAsync,
      publicClient,
      refreshBalance,
    ],
  );

  const payAgentSignalWithWallet = useCallback(
    async (amountUsd: number): Promise<WalletFundResult> => {
      if (!externalConnected || !address) {
        throw new Error("Connect your wallet from Profile or the account menu");
      }

      if (linkedExternal && connectedAddr && linkedExternal !== connectedAddr) {
        throw new Error(
          "Connected wallet does not match your linked address — reconnect or change wallet in Profile",
        );
      }

      if (connectedBalance.usdc < amountUsd) {
        throw new Error(
          `Insufficient connected wallet balance: $${connectedBalance.usdc.toFixed(2)} on Arc, need $${amountUsd.toFixed(3)}`,
        );
      }

      const routeRes = await fetch("/api/capital/payment-route?action=agent_signal", {
        credentials: "include",
      });
      const route = await parseJsonResponse<{
        ok?: boolean;
        address?: string;
        label?: string;
        error?: string;
      }>(routeRes);
      if (!routeRes.ok || !route.ok || !route.address) {
        throw new Error(route.error ?? "Could not resolve agent settlement address");
      }

      if (signingRef.current) {
        throw new Error("Wallet transaction already in progress");
      }

      signingRef.current = true;
      try {
        const linked = await ensureExternalLinked();
        if (!linked) {
          throw new Error("Could not link wallet to your account — try again from Profile");
        }

        await ensureArc();

        toast.message(`Sign to send $${amountUsd.toFixed(3)} USDC for agent signal`, {
          id: "wallet-agent-pay",
        });

        const hash = await sendTransactionAsync({
          chainId: arcTestnet.id,
          to: route.address as `0x${string}`,
          value: usdcToWei(amountUsd),
        });

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        toast.success("Agent payment sent on Arc", { id: "wallet-agent-pay" });
        await refreshBalance().catch(() => null);
        connectedBalance.refetch();
        return { txHash: hash };
      } catch (e) {
        toast.dismiss("wallet-agent-pay");
        throw e;
      } finally {
        signingRef.current = false;
      }
    },
    [
      externalConnected,
      address,
      linkedExternal,
      connectedAddr,
      connectedBalance,
      ensureArc,
      ensureExternalLinked,
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
    payAgentSignalWithWallet,
    openConnectWallet,
    ensureArc,
  };
}
