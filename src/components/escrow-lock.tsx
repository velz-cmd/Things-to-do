"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { decodeEventLog } from "viem";
import {
  DEPUTY_ESCROW_ABI,
  DEPUTY_ESCROW_ADDRESS,
  arcTestnet,
  isEscrowMisconfigured,
} from "@/lib/arc/config";
import { taskRefFromId, usdcToWei } from "@/lib/arc/utils";
import { ensureArcNetwork, isArcChain } from "@/lib/arc/wallet";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "sonner";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { DepositPrompt } from "@/components/wallet/deposit-prompt";
import { AgentEscrowBadge } from "@/components/resolve/access-gate";

interface EscrowLockProps {
  taskId: string;
  budgetUsd: number;
  successFeeUsd: number;
  locked: boolean;
  escrowTxHash?: string | null;
  onLocked: () => void;
}

export function EscrowLock({
  taskId,
  budgetUsd,
  successFeeUsd,
  locked,
  escrowTxHash,
  onLocked,
}: EscrowLockProps) {
  const { address, isConnected } = useAccount();
  const { user, refreshBalance } = useAuth();
  const { ready } = useResolveAccess();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const [demoLocking, setDemoLocking] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [needsDeposit, setNeedsDeposit] = useState(false);
  const [showWalletLock, setShowWalletLock] = useState(false);
  const syncedRef = useRef(false);
  const contractReady =
    Boolean(DEPUTY_ESCROW_ADDRESS) && !isEscrowMisconfigured();

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: confirming } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (!receipt || locked || syncedRef.current || !publicClient) return;

    async function syncEscrow() {
      try {
        let onChainTaskId: number | null = null;

        for (const log of receipt!.logs) {
          if (
            DEPUTY_ESCROW_ADDRESS &&
            log.address.toLowerCase() !== DEPUTY_ESCROW_ADDRESS.toLowerCase()
          ) {
            continue;
          }
          try {
            const decoded = decodeEventLog({
              abi: DEPUTY_ESCROW_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "TaskCreated") {
              onChainTaskId = Number(
                (decoded.args as { taskId: bigint }).taskId
              );
              break;
            }
          } catch {
            // not our event
          }
        }

        if (onChainTaskId == null && DEPUTY_ESCROW_ADDRESS) {
          const nextId = await publicClient!.readContract({
            address: DEPUTY_ESCROW_ADDRESS,
            abi: DEPUTY_ESCROW_ABI,
            functionName: "nextTaskId",
          });
          if (nextId > BigInt(0)) {
            onChainTaskId = Number(nextId) - 1;
          }
        }

        if (onChainTaskId == null) {
          setSyncError(
            "Transaction confirmed but escrow task id was not found. Try locking from your RESOLVE balance instead."
          );
          return;
        }

        await fetch("/api/escrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            escrowTxHash: receipt!.transactionHash,
            escrowTaskId: onChainTaskId,
            userWallet: address,
          }),
        });

        syncedRef.current = true;
        toast.success("Escrow locked on Arc", {
          description: `$${budgetUsd.toFixed(2)} USDC secured`,
        });
        onLocked();
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : "Escrow sync failed");
      }
    }

    void syncEscrow();
  }, [
    receipt,
    locked,
    publicClient,
    taskId,
    address,
    onLocked,
    budgetUsd,
  ]);

  async function lockFromBalance() {
    setDemoLocking(true);
    setSyncError(null);
    setNeedsDeposit(false);
    try {
      const res = await fetch("/api/escrow/balance-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lock failed");
      toast.success("Task budget locked", {
        description: `$${budgetUsd.toFixed(2)} reserved — no wallet signature needed`,
      });
      await refreshBalance();
      onLocked();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lock failed";
      setSyncError(msg);
      if (msg.toLowerCase().includes("need $") || msg.toLowerCase().includes("add funds")) {
        setNeedsDeposit(true);
      }
      toast.error("Could not lock budget", { description: msg });
    } finally {
      setDemoLocking(false);
    }
  }

  async function lockOnChain() {
    if (!DEPUTY_ESCROW_ADDRESS || isEscrowMisconfigured()) return;
    syncedRef.current = false;
    setSyncError(null);
    setNeedsDeposit(false);

    try {
      await ensureArcNetwork();
      if (!isArcChain(chainId)) {
        await switchChainAsync({ chainId: arcTestnet.id });
      }
    } catch (e) {
      setSyncError(
        e instanceof Error
          ? e.message
          : "Switch wallet to Arc Testnet (chain 5042002)"
      );
      return;
    }

    writeContract({
      chainId: arcTestnet.id,
      address: DEPUTY_ESCROW_ADDRESS,
      abi: DEPUTY_ESCROW_ABI,
      functionName: "createTask",
      args: [taskRefFromId(taskId), usdcToWei(successFeeUsd)],
      value: usdcToWei(budgetUsd),
    });
  }

  const preferBalanceLock = ready && !showWalletLock;

  if (!ready && !locked) {
    return (
      <div className="space-y-2 rounded-lg border border-deputy-border bg-deputy-bg/40 px-3 py-3 text-sm text-deputy-muted">
        <p>Sign in with Google or email to lock funds. Add balance from the menu if needed.</p>
        <AgentEscrowBadge />
      </div>
    );
  }

  if (locked) {
    return (
      <div className="rounded-lg border border-deputy-accent/30 bg-deputy-accent/5 p-3">
        <p className="text-xs uppercase text-deputy-muted">Balance secured</p>
        <p className="text-sm text-deputy-accent">
          Locked · ${budgetUsd.toFixed(2)} USDC
        </p>
        {escrowTxHash && (
          <VerifiedTxLink hash={escrowTxHash} />
        )}
      </div>
    );
  }

  if (preferBalanceLock) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-deputy-border/80 bg-deputy-bg/40 px-3 py-2">
          <p className="text-xs font-medium text-white">RESOLVE agent escrow</p>
          <p className="mt-1 text-xs leading-relaxed text-deputy-muted">
            Budget is custodied by the RESOLVE agent until proof is verified.
            Funds are held against your linked wallet — success fee only after
            resolution.
          </p>
          <AgentEscrowBadge className="mt-2" />
        </div>
        <button
          type="button"
          disabled={demoLocking}
          onClick={lockFromBalance}
          className="w-full rounded-lg bg-deputy-accent py-2.5 text-sm font-semibold text-deputy-bg transition hover:brightness-110 disabled:opacity-50"
        >
          {demoLocking
            ? "Locking budget…"
            : `Lock $${budgetUsd.toFixed(2)} from balance`}
        </button>
        {contractReady && isConnected && (
          <button
            type="button"
            onClick={() => setShowWalletLock(true)}
            className="w-full text-xs text-deputy-muted underline hover:text-white"
          >
            Or lock on Arc with wallet (advanced)
          </button>
        )}
        {needsDeposit && (
          <DepositPrompt amountUsd={budgetUsd} className="mt-2" />
        )}
        {syncError && !needsDeposit && (
          <p className="text-xs text-deputy-danger">{syncError}</p>
        )}
      </div>
    );
  }

  if (!contractReady || !isConnected) {
    return (
      <div className="space-y-2">
        {isEscrowMisconfigured() && (
          <p className="rounded-lg border border-deputy-danger/40 bg-deputy-danger/10 px-3 py-2 text-xs text-deputy-danger">
            Escrow contract misconfigured. Set{" "}
            <code className="font-mono">NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS</code>{" "}
            to the contract (<code className="font-mono">0x4e9b…f669f</code>),
            not the agent escrow wallet.
          </p>
        )}
        <button
          type="button"
          disabled={demoLocking}
          onClick={lockFromBalance}
          className="w-full rounded-lg border border-deputy-accent/40 bg-deputy-accent/10 py-2 text-sm font-medium text-deputy-accent transition hover:bg-deputy-accent/20 disabled:opacity-50"
        >
          {demoLocking
            ? "Locking…"
            : `Lock $${budgetUsd.toFixed(2)} from balance`}
        </button>
        {needsDeposit && (
          <DepositPrompt amountUsd={budgetUsd} className="mt-2" />
        )}
        {syncError && !needsDeposit && (
          <p className="text-xs text-deputy-danger">{syncError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowWalletLock(false)}
        className="text-xs text-deputy-accent underline"
      >
        ← Use RESOLVE balance instead (recommended)
      </button>
      <div className="rounded-lg border border-deputy-border/80 bg-deputy-bg/40 px-3 py-2 text-xs text-deputy-muted">
        On-chain lock sends USDC to the escrow contract{" "}
        <span className="font-mono text-white">
          {DEPUTY_ESCROW_ADDRESS?.slice(0, 8)}…
        </span>
        . Success fee later goes to the RESOLVE agent — not a treasury label in
        your wallet.
      </div>
      <button
        type="button"
        disabled={isPending || confirming}
        onClick={lockOnChain}
        className="w-full rounded-lg border border-deputy-accent/40 bg-deputy-accent/10 py-2 text-sm font-medium text-deputy-accent transition hover:bg-deputy-accent/20 disabled:opacity-50"
      >
        {isPending || confirming
          ? "Confirming on Arc…"
          : `Lock $${budgetUsd.toFixed(2)} USDC on Arc`}
      </button>
      <p className="text-[10px] leading-relaxed text-deputy-muted">
        Arc Testnet (chain 5042002). Some wallets show &quot;Simulation Not
        Supported&quot; — that is normal on testnet. Get USDC from{" "}
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noreferrer"
          className="text-deputy-accent underline"
        >
          faucet.circle.com
        </a>
        .
      </p>
      {(error || syncError) && (
        <p className="text-xs text-deputy-danger">
          {error?.message ?? syncError}
        </p>
      )}
    </div>
  );
}

function VerifiedTxLink({ hash }: { hash: string }) {
  const [status, setStatus] = useState<"loading" | "verified" | "pending">("loading");

  useEffect(() => {
    fetch(`/api/settlement/verify-tx/${hash}`)
      .then((r) => r.json())
      .then((d) => {
        setStatus(
          d.verification?.found && d.verification?.success ? "verified" : "pending"
        );
      })
      .catch(() => setStatus("pending"));
  }, [hash]);

  if (status === "loading") {
    return <p className="mt-1 text-xs text-deputy-muted">Verifying on Arc…</p>;
  }

  if (status === "verified") {
    return (
      <a
        href={`https://testnet.arcscan.app/tx/${hash}`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block truncate font-mono text-xs text-deputy-accent underline"
      >
        {hash}
      </a>
    );
  }

  return (
    <p className="mt-1 text-xs text-deputy-warn">
      Tx pending / not indexed on Arc — no explorer link shown
    </p>
  );
}
