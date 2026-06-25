"use client";

import Link from "next/link";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import type { PaymentPreview } from "@/lib/payment/preview";

export function PaymentPreviewPanel({
  preview,
  onApprove,
  onBack,
  approving,
}: {
  preview: PaymentPreview;
  onApprove: () => void;
  onBack: () => void;
  approving?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Panel className="border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-amber-300">
          Payment preview — approve before execute
        </p>
        <p className="mt-1 text-xs text-resolve-muted">
          Mission {preview.repo} · Proof {preview.proofHash.slice(0, 14)}…
        </p>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Treasury" value={preview.treasuryUsd} accent />
        <Metric label="Ready to pay" value={preview.readyToPayUsd} />
        <Metric label="Pending claim" value={preview.pendingClaimUsd} warn />
        <Metric label="Agent nano" value={preview.nanoAgentUsd} />
        <Metric label="Gas estimate" value={preview.gasEstimateUsd} />
        <Metric label="Locked" value={preview.lockedUsd} />
        <Metric label="Reserved" value={preview.reservedUsd} warn />
        <Metric label="Remaining" value={preview.availableUsd} accent />
      </div>

      <Panel className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
          Contributor split
        </p>
        <ul className="mt-3 divide-y divide-resolve-border text-xs">
          {preview.contributors.map((c) => (
            <li key={c.login} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-medium text-white">@{c.login}</p>
                <p className="text-resolve-muted">
                  Weight {c.weight} · {c.sharePercent}% share
                </p>
              </div>
              <div className="text-right">
                <Money amount={c.amountUsd} size="sm" />
                <p
                  className={
                    c.walletStatus === "ready" ?
                      "mt-0.5 text-[10px] text-emerald-400"
                    : "mt-0.5 text-[10px] text-amber-300"
                  }
                >
                  {c.walletStatus === "ready" ? "Wallet ready" : "Claim portal"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {preview.pendingCount > 0 && (
        <Panel className="border-amber-500/20 p-3 text-xs text-amber-200">
          {preview.pendingCount} contributor{preview.pendingCount > 1 ? "s" : ""} without wallets
          will receive <Money amount={preview.pendingClaimUsd} size="sm" className="inline" /> via the{" "}
          <Link href="/payments?tab=claim" className="underline">
            claim portal
          </Link>{" "}
          after you execute.
        </Panel>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={approving}
          className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {approving ? "Locking escrow & settling…" : "Approve & execute settlement"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-resolve-border px-4 py-2 text-sm text-resolve-muted hover:text-white"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <Panel className="p-3">
      <p className="text-[10px] uppercase text-resolve-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          warn ? "text-amber-300" : accent ? "text-emerald-400" : "text-white"
        }`}
      >
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </Panel>
  );
}
