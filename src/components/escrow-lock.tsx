"use client";

import { useState, useEffect, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { decodeEventLog } from "viem";
import {
  DEPUTY_ESCROW_ABI,
  DEPUTY_ESCROW_ADDRESS,
} from "@/lib/arc/config";
import { taskRefFromId, usdcToWei } from "@/lib/arc/utils";
import clsx from "clsx";

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
  const publicClient = usePublicClient();
  const [demoLocking, setDemoLocking] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncedRef = useRef(false);
  const contractReady = Boolean(DEPUTY_ESCROW_ADDRESS);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: confirming } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (!receipt || locked || syncedRef.current || !publicClient) return;

    async function syncEscrow() {
      try {
        let onChainTaskId: number | null = null;

        for (const log of receipt!.logs) {
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

        if (onChainTaskId == null) {
          setSyncError("Could not read TaskCreated from receipt");
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
        onLocked();
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : "Escrow sync failed");
      }
    }

    void syncEscrow();
  }, [receipt, locked, publicClient, taskId, address, onLocked]);

  async function lockDemoEscrow() {
    setDemoLocking(true);
    const mockTx =
      "0x" +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
    await fetch("/api/escrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        escrowTxHash: mockTx,
        escrowTaskId: Math.floor(Math.random() * 10000) + 1,
        userWallet: address,
      }),
    });
    setDemoLocking(false);
    onLocked();
  }

  function lockOnChain() {
    if (!DEPUTY_ESCROW_ADDRESS) return;
    syncedRef.current = false;
    setSyncError(null);
    writeContract({
      address: DEPUTY_ESCROW_ADDRESS,
      abi: DEPUTY_ESCROW_ABI,
      functionName: "createTask",
      args: [taskRefFromId(taskId), usdcToWei(successFeeUsd)],
      value: usdcToWei(budgetUsd),
    });
  }

  if (locked) {
    return (
      <div className="rounded-lg border border-deputy-accent/30 bg-deputy-accent/5 p-3">
        <p className="text-xs uppercase text-deputy-muted">Arc escrow</p>
        <p className="text-sm text-deputy-accent">
          Locked · ${budgetUsd.toFixed(2)} USDC
        </p>
        {escrowTxHash && (
          <a
            href={`https://testnet.arcscan.app/tx/${escrowTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate font-mono text-xs text-deputy-muted underline"
          >
            {escrowTxHash}
          </a>
        )}
      </div>
    );
  }

  if (!contractReady || !isConnected) {
    return (
      <div>
        <button
          type="button"
          disabled={demoLocking}
          onClick={lockDemoEscrow}
          className={clsx(
            "w-full rounded-lg border border-deputy-accent/40 bg-deputy-accent/10 py-2 text-sm font-medium text-deputy-accent transition hover:bg-deputy-accent/20 disabled:opacity-50"
          )}
        >
          {demoLocking ? "Locking escrow…" : `Lock $${budgetUsd.toFixed(2)} demo escrow`}
        </button>
        {contractReady && !isConnected && (
          <p className="mt-1 text-xs text-deputy-muted">
            Connect Arc wallet for on-chain escrow
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
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
      {(error || syncError) && (
        <p className="mt-1 text-xs text-deputy-danger">
          {error?.message ?? syncError}
        </p>
      )}
    </div>
  );
}
