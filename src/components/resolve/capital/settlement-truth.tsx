"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import clsx from "clsx";
import { Money } from "@/components/resolve/ui/money";
import { isOnChainTxHash } from "@/lib/payment/tx-utils";

type VerificationState =
  | { status: "loading" }
  | { status: "verified"; explorerUrl: string }
  | { status: "pending"; explorerUrl?: string }
  | { status: "ledger_only" };

function useTxVerification(txHash: string | null | undefined): VerificationState {
  const [state, setState] = useState<VerificationState>({ status: "loading" });

  useEffect(() => {
    if (!txHash || !isOnChainTxHash(txHash)) {
      setState({ status: "ledger_only" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void fetch(`/api/settlement/verify-tx/${txHash}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const v = d.verification;
        if (d.ok && v?.found && v?.success) {
          setState({ status: "verified", explorerUrl: v.explorerUrl });
        } else if (v?.explorerUrl) {
          setState({ status: "pending", explorerUrl: v.explorerUrl });
        } else {
          setState({ status: "pending" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "pending" });
      });
    return () => {
      cancelled = true;
    };
  }, [txHash]);

  return state;
}

export function SettlementTruthBadge({
  txHash,
  dbStatus,
}: {
  txHash: string | null | undefined;
  dbStatus: string;
}) {
  const verification = useTxVerification(txHash);

  if (verification.status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-resolve-muted">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verifying…
      </span>
    );
  }

  if (verification.status === "verified") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          Verified on Arc
        </span>
        <a
          href={verification.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-[10px] text-resolve-accent hover:underline"
        >
          Explorer
          <ExternalLink className="h-3 w-3" />
        </a>
      </span>
    );
  }

  if (verification.status === "pending" && txHash && isOnChainTxHash(txHash)) {
    return (
      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200/90">
        Pending indexer — not marked paid
      </span>
    );
  }

  const normalized = dbStatus.toLowerCase();
  if (normalized.includes("settled") || normalized.includes("released")) {
    return (
      <span className="text-[10px] text-resolve-muted">Recorded in RESOLVE · payment proof pending</span>
    );
  }

  return (
    <span className="text-[10px] capitalize text-resolve-muted-dim">
      {dbStatus.replace(/_/g, " ")}
    </span>
  );
}

export function CapitalSettlementRow({
  label,
  amountUsd,
  txHash,
  status,
  at,
  receiptId,
}: {
  label: string;
  amountUsd: number;
  txHash?: string | null;
  status: string;
  at?: string;
  receiptId?: string;
}) {
  return (
    <li className="flex flex-col gap-2 border-b border-resolve-border/40 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm text-resolve-muted">{label}</p>
        {at && (
          <p className="text-[10px] text-resolve-muted-dim">
            {new Date(at).toLocaleString()}
          </p>
        )}
        {receiptId && (
          <Link
            href={`/receipt/${receiptId}`}
            className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-resolve-accent hover:underline"
          >
            View receipt
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className={clsx("flex flex-col items-start gap-1 sm:items-end")}>
        <Money amount={amountUsd} size="sm" className="text-white" />
        <SettlementTruthBadge txHash={txHash} dbStatus={status} />
      </div>
    </li>
  );
}
