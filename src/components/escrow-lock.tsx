"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
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
  const { isConnected } = useAccount();
  const [demoLocking, setDemoLocking] = useState(false);
  const contractReady = Boolean(DEPUTY_ESCROW_ADDRESS);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

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
      }),
    });
    setDemoLocking(false);
    onLocked();
  }

  async function lockOnChain() {
    if (!DEPUTY_ESCROW_ADDRESS) return;
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
        <p className="text-sm text-deputy-accent">Locked · ${budgetUsd.toFixed(2)} USDC</p>
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
    );
  }

  return (
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
  );
}
