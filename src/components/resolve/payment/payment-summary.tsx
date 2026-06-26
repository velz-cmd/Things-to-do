"use client";

import Link from "next/link";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import type { PaymentPreview } from "@/lib/payment/preview";

/** Stripe-style payment confirmation — no architecture jargon. */
export function PaymentSummary({
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
  const ready = preview.readyToPayUsd > 0 || preview.pendingClaimUsd > 0;

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
          Payment summary
        </p>
        <p className="mt-1 text-lg font-semibold text-white">{preview.repo}</p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row label="Treasury" value={<Money amount={preview.treasuryUsd} size="sm" />} />
          <Row label="Recipients" value={String(preview.contributors.length)} />
          <Row
            label="Ready to pay"
            value={<Money amount={preview.readyToPayUsd} size="sm" />}
            accent
          />
          {preview.pendingCount > 0 && (
            <Row
              label="Via claim portal"
              value={<Money amount={preview.pendingClaimUsd} size="sm" />}
            />
          )}
          <Row label="Gas estimate" value={<Money amount={preview.gasEstimateUsd} size="sm" />} />
          <Row label="Network" value="Arc" />
          <Row
            label="Status"
            value={
              <span className={ready ? "text-emerald-300" : "text-amber-300"}>
                {ready ? "Ready" : "Review required"}
              </span>
            }
          />
        </dl>
      </Panel>

      {preview.pendingCount > 0 && (
        <p className="text-xs text-resolve-muted">
          {preview.pendingCount} contributor{preview.pendingCount > 1 ? "s" : ""} without wallets will
          claim on the{" "}
          <Link href="/payments?tab=claim" className="text-resolve-accent hover:underline">
            Payments
          </Link>{" "}
          page after you approve.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={approving || !ready}
          className="rounded-md bg-resolve-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {approving ? "Fulfilling settlement…" : "Fulfill settlement"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-resolve-border px-5 py-2.5 text-sm text-resolve-muted hover:text-white"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <dt className="text-resolve-muted">{label}</dt>
      <dd className={accent ? "font-medium text-emerald-300" : "font-medium text-white"}>{value}</dd>
    </div>
  );
}
