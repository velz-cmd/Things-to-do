"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Copy,
  ExternalLink,
  Receipt,
  Share2,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { Panel } from "@/components/resolve/ui/panel";
import { Money, MonoHash } from "@/components/resolve/ui/money";
import { StatusChip } from "@/components/resolve/ui/status-chip";
import { SettlementTruthBadge } from "@/components/resolve/capital/settlement-truth";
import type { PublicReceipt, PublicReceiptPayee } from "@/lib/ledger/receipt";
import {
  RECEIPT_COPY,
  friendlyEventType,
  friendlyReceiptStatus,
  receiptKindCopy,
} from "@/lib/receipt/copy";

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

function RecipientRow({ payee }: { payee: PublicReceiptPayee }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{payee.label}</p>
        <p className="text-[11px] text-resolve-muted">{payee.role}</p>
        {payee.walletAddress && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[10px] text-resolve-muted-dim hover:text-resolve-muted">
              Payout account (advanced)
            </summary>
            <MonoHash value={payee.walletAddress} className="mt-1 block text-[10px]" />
          </details>
        )}
      </div>
      <div className="shrink-0 text-right">
        <Money amount={payee.amountUsd} size="sm" className="text-emerald-300" />
        {payee.status && (
          <p className="mt-0.5 text-[10px] text-resolve-muted-dim">
            {friendlyReceiptStatus(payee.status)}
          </p>
        )}
      </div>
    </li>
  );
}

export function PublicEarnReceipt({ receipt }: { receipt: PublicReceipt }) {
  const isEarning = receipt.kind === "earning";
  const copy = receiptKindCopy(receipt.kind);
  const KindIcon = isEarning ? BadgeCheck : Users;

  function copyLink() {
    void navigator.clipboard.writeText(window.location.href);
    toast.success(RECEIPT_COPY.shareCopied);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            {RECEIPT_COPY.pageEyebrow}
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            <KindIcon className="h-3.5 w-3.5 text-resolve-accent" />
            <span className="text-[10px] font-semibold tracking-wide text-resolve-accent">
              {copy.badge}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">{copy.title}</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-resolve-muted">
            {copy.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white hover:border-resolve-accent/30"
        >
          <Share2 className="h-3.5 w-3.5" />
          {RECEIPT_COPY.share}
        </button>
      </div>

      <Panel className="overflow-hidden p-0" variant="glow">
        <div
          className={clsx(
            "border-b border-resolve-border-strong px-5 py-4",
            isEarning ? "bg-violet-500/5" : "bg-emerald-500/5",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              label={friendlyReceiptStatus(receipt.status)}
              variant={statusVariant(receipt.status)}
            />
            <span className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">
              {receipt.mission.communityName}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-resolve-muted">
                {copy.amountLabel}
              </p>
              <Money amount={receipt.amountUsd} size="lg" className="mt-1" />
            </div>
            {receipt.currency && (
              <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-medium text-resolve-muted">
                Paid in {receipt.currency}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-2">
          <ReceiptMeta
            label={RECEIPT_COPY.fields.mission}
            value={receipt.mission.programName ?? receipt.mission.communityName}
          />
          <ReceiptMeta label={RECEIPT_COPY.fields.community} value={receipt.mission.communityName} />
          <ReceiptMeta label={RECEIPT_COPY.fields.source} value={receipt.connector.label} />
          {receipt.connector.eventType && (
            <ReceiptMeta
              label={RECEIPT_COPY.fields.activity}
              value={friendlyEventType(receipt.connector.eventType)}
            />
          )}
          {receipt.contextLabel && (
            <ReceiptMeta label={RECEIPT_COPY.fields.context} value={receipt.contextLabel} />
          )}
          {receipt.proofHash && (
            <ReceiptMeta label={RECEIPT_COPY.fields.proof} value={receipt.proofHash} mono />
          )}
          <ReceiptMeta
            label={RECEIPT_COPY.fields.recorded}
            value={new Date(receipt.createdAt).toLocaleString()}
          />
          {receipt.settledAt && (
            <ReceiptMeta
              label={RECEIPT_COPY.fields.paid}
              value={new Date(receipt.settledAt).toLocaleString()}
            />
          )}
        </div>

        {isEarning && receipt.payee && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
              {RECEIPT_COPY.earning.recipientSection}
            </p>
            <div className="mt-3">
              <RecipientRow payee={receipt.payee} />
            </div>
          </div>
        )}

        {!isEarning && receipt.payees && receipt.payees.length > 0 && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
                {RECEIPT_COPY.payout.recipientSection} ({receipt.payeeCount ?? receipt.payees.length})
              </p>
              {receipt.earningCount != null && receipt.earningCount > 0 && (
                <span className="text-[10px] text-resolve-muted">
                  {RECEIPT_COPY.payout.itemsLabel(receipt.earningCount)}
                </span>
              )}
            </div>
            <ul>
              {receipt.payees.slice(0, 12).map((payee) => (
                <RecipientRow key={`${payee.keyType}:${payee.key}`} payee={payee} />
              ))}
            </ul>
          </div>
        )}

        {receipt.platformFee && (
          <div className="border-t border-white/[0.06] bg-violet-500/[0.04] px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-violet-300/90">
              {RECEIPT_COPY.platformFee.title}
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-resolve-muted">
                  {receipt.kind === "payout" ? "Batch gross" : RECEIPT_COPY.platformFee.signalCost}
                </dt>
                <dd>
                  <Money amount={receipt.platformFee.grossUsd} size="sm" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-resolve-muted">
                  {RECEIPT_COPY.platformFee.resolveFee} ({receipt.platformFee.platformFeeBps / 100}%)
                </dt>
                <dd>
                  <Money amount={receipt.platformFee.platformFeeUsd} size="sm" className="text-violet-300" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2">
                <dt className="text-resolve-muted">
                  {receipt.kind === "payout" ? "Net to creators" : RECEIPT_COPY.platformFee.netToProvider}
                </dt>
                <dd>
                  <Money amount={receipt.platformFee.netToProviderUsd} size="sm" className="text-emerald-300" />
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-resolve-muted-dim">
              {receipt.platformFee.note}
            </p>
          </div>
        )}

        {receipt.poolSummary && (
          <div className="border-t border-white/[0.06] bg-emerald-500/[0.04] px-5 py-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300/90">
              Program pool
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-resolve-muted">Pool balance (real USDC)</dt>
                <dd>
                  <Money amount={receipt.poolSummary.poolBalanceUsd} size="sm" className="text-emerald-300" />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-resolve-muted">Owed to {receipt.poolSummary.payeeCategory}</dt>
                <dd>
                  <Money amount={receipt.poolSummary.owedToCreatorsUsd} size="sm" className="text-amber-200" />
                </dd>
              </div>
            </dl>
            {receipt.poolSummary.nextCheckpointUsd != null && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-resolve-muted-dim">
                  <span>Next checkpoint</span>
                  <span>
                    ${receipt.poolSummary.poolBalanceUsd.toFixed(0)} / $
                    {receipt.poolSummary.nextCheckpointUsd.toFixed(0)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-emerald-400/80"
                    style={{ width: `${Math.min(100, receipt.poolSummary.progressToNextPct)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-white/[0.06] bg-[#070b12]/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 text-resolve-muted" />
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-muted-dim">
              {RECEIPT_COPY.paymentProof.title}
            </p>
          </div>
          {receipt.arc.onChain && receipt.arc.txHash ?
            <div className="mt-3 space-y-3">
              <details>
                <summary className="cursor-pointer text-xs text-resolve-muted hover:text-white">
                  {RECEIPT_COPY.paymentProof.optionalNote}
                </summary>
                <MonoHash value={receipt.arc.txHash} className="mt-2 block text-[11px]" />
              </details>
              <div className="flex flex-wrap items-center gap-3">
                <SettlementTruthBadge txHash={receipt.arc.txHash} dbStatus={receipt.status} />
                {receipt.arc.explorerUrl && (
                  <a
                    href={receipt.arc.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-resolve-border-strong bg-resolve-hover px-3 py-2 text-xs font-medium text-white hover:border-resolve-accent/40"
                  >
                    {RECEIPT_COPY.paymentProof.viewExplorer}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          : <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
              {RECEIPT_COPY.paymentProof.pending}
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
            {RECEIPT_COPY.viewCommunity}: {receipt.mission.communityName}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
        <Link href="/payments" className="text-resolve-muted hover:text-white">
          {RECEIPT_COPY.openPayments}
        </Link>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1 text-resolve-muted hover:text-white"
        >
          <Copy className="h-3 w-3" />
          {RECEIPT_COPY.copyUrl}
        </button>
      </div>

      <p className="mt-8 text-center text-[10px] text-resolve-muted-dim">
        {RECEIPT_COPY.footer} · {copy.badge} · {receipt.id}
      </p>
    </div>
  );
}

/** @deprecated use PublicEarnReceipt */
export const PublicLedgerReceipt = PublicEarnReceipt;
