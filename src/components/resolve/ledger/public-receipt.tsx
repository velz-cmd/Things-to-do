"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Copy,
  ExternalLink,
  Radio,
  ScrollText,
  Share2,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { Panel } from "@/components/resolve/ui/panel";
import { Money, MonoHash } from "@/components/resolve/ui/money";
import { StatusChip } from "@/components/resolve/ui/status-chip";
import { SettlementTruthBadge } from "@/components/resolve/capital/settlement-truth";
import type { PublicReceipt, PublicReceiptPayee } from "@/lib/ledger/receipt";

function statusVariant(status: string): "settled" | "pending" | "default" {
  const s = status.toLowerCase();
  if (s.includes("settled") || s === "claimable" || s === "claimed") return "settled";
  if (s.includes("pending") || s.includes("processing")) return "pending";
  return "default";
}

function ReceiptMeta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
        {label}
      </p>
      {mono ?
        <MonoHash value={value} className="mt-1 block text-[11px]" />
      : <p className="mt-1 text-sm text-white">{value}</p>}
    </div>
  );
}

function PayeeRow({ payee }: { payee: PublicReceiptPayee }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{payee.label}</p>
        <p className="text-[11px] text-resolve-muted">
          {payee.role} · {payee.keyType.replace(/_/g, " ")}
        </p>
        {payee.walletAddress && (
          <MonoHash value={payee.walletAddress} className="mt-1 block text-[10px]" />
        )}
      </div>
      <div className="shrink-0 text-right">
        <Money amount={payee.amountUsd} size="sm" className="text-emerald-300" />
        {payee.status && (
          <p className="mt-0.5 text-[10px] capitalize text-resolve-muted-dim">
            {payee.status.replace(/_/g, " ")}
          </p>
        )}
      </div>
    </li>
  );
}

export function PublicLedgerReceipt({ receipt }: { receipt: PublicReceipt }) {
  const isSignal = receipt.kind === "signal";
  const KindIcon = isSignal ? Radio : ScrollText;
  const kindLabel = isSignal ? "SIGNAL" : "LEDGER";

  function copyLink() {
    void navigator.clipboard.writeText(window.location.href);
    toast.success("Receipt link copied");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            <KindIcon className="h-3.5 w-3.5 text-resolve-accent" />
            <span className="text-[10px] font-semibold tracking-[0.2em] text-resolve-accent">
              {kindLabel}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {isSignal ? "Authorization receipt" : "Settlement receipt"}
          </h1>
          <p className="mt-1 text-sm text-resolve-muted">
            Public proof of verified value — mission, connector, payee, and Arc settlement.
          </p>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white hover:border-resolve-accent/30"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
      </div>

      <Panel className="overflow-hidden p-0" variant="glow">
        <div
          className={clsx(
            "border-b border-resolve-border-strong px-5 py-4",
            isSignal ? "bg-violet-500/5" : "bg-emerald-500/5",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={receipt.status.replace(/_/g, " ")} variant={statusVariant(receipt.status)} />
            <span className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">
              {receipt.mission.communityName}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-resolve-muted">
                {isSignal ? "Authorized amount" : "Settlement total"}
              </p>
              <Money amount={receipt.amountUsd} size="lg" className="mt-1" />
            </div>
            {receipt.currency && (
              <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-medium text-resolve-muted">
                {receipt.currency}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-2">
          <ReceiptMeta label="Mission" value={receipt.mission.programName ?? receipt.mission.id} />
          <ReceiptMeta label="Community" value={receipt.mission.communityName} />
          <ReceiptMeta label="Connector" value={receipt.connector.label} />
          {receipt.connector.eventType && (
            <ReceiptMeta label="Event" value={receipt.connector.eventType.replace(/_/g, " ")} />
          )}
          {receipt.contextLabel && <ReceiptMeta label="Context" value={receipt.contextLabel} />}
          {receipt.proofHash && (
            <ReceiptMeta label="Proof hash" value={receipt.proofHash} mono />
          )}
          <ReceiptMeta
            label="Recorded"
            value={new Date(receipt.createdAt).toLocaleString()}
          />
          {receipt.settledAt && (
            <ReceiptMeta label="Settled" value={new Date(receipt.settledAt).toLocaleString()} />
          )}
        </div>

        {isSignal && receipt.payee && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
              Payee
            </p>
            <div className="mt-3">
              <PayeeRow payee={receipt.payee} />
            </div>
          </div>
        )}

        {!isSignal && receipt.payees && receipt.payees.length > 0 && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
                Payees ({receipt.payeeCount ?? receipt.payees.length})
              </p>
              {receipt.signalCount != null && receipt.signalCount > 0 && (
                <span className="text-[10px] text-resolve-muted">
                  {receipt.signalCount} signal{receipt.signalCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <ul>
              {receipt.payees.slice(0, 12).map((payee) => (
                <PayeeRow key={`${payee.keyType}:${payee.key}`} payee={payee} />
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-white/[0.06] bg-[#070b12]/60 px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
            Arc settlement
          </p>
          {receipt.arc.onChain && receipt.arc.txHash ?
            <div className="mt-3 space-y-3">
              <MonoHash value={receipt.arc.txHash} className="block text-[11px]" />
              <div className="flex flex-wrap items-center gap-3">
                <SettlementTruthBadge txHash={receipt.arc.txHash} dbStatus={receipt.status} />
                {receipt.arc.explorerUrl && (
                  <a
                    href={receipt.arc.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-resolve-border-strong bg-resolve-hover px-3 py-2 text-xs font-medium text-white hover:border-resolve-accent/40"
                  >
                    View on Arcscan
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          : <p className="mt-2 text-xs text-resolve-muted">
              Ledger recorded — on-chain Arc transaction appears after live settlement batch.
            </p>
          }
        </div>
      </Panel>

      <div className="mt-6 flex flex-wrap gap-3 text-xs">
        {receipt.mission.communitySlug && (
          <Link
            href={`/communities/${receipt.mission.communitySlug}`}
            className="inline-flex items-center gap-1 text-resolve-accent hover:underline"
          >
            {receipt.mission.communityName} community
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
        <Link href="/payments" className="text-resolve-muted hover:text-white">
          Open payments
        </Link>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1 text-resolve-muted hover:text-white"
        >
          <Copy className="h-3 w-3" />
          Copy receipt URL
        </button>
      </div>

      <p className="mt-8 text-center text-[10px] text-resolve-muted-dim">
        RESOLVE public receipt · {kindLabel} · {receipt.id}
      </p>
    </div>
  );
}
