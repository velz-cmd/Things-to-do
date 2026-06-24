"use client";

import { ExternalLink, Download } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money, MonoHash } from "@/components/resolve/ui/money";
import { StatusChip } from "@/components/resolve/ui/status-chip";

export function SettlementReceipt({
  title = "Settlement complete",
  amountUsd,
  payeeCount,
  eventCount,
  txHash,
  explorerUrl,
  complianceCsv,
  onDownload,
}: {
  title?: string;
  amountUsd: number;
  payeeCount?: number;
  eventCount?: number;
  txHash?: string | null;
  explorerUrl?: string | null;
  complianceCsv?: string;
  onDownload?: () => void;
}) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-resolve-border-strong bg-emerald-500/5 px-5 py-4">
        <StatusChip label="Settled" variant="settled" />
        <p className="mt-2 text-sm font-medium text-white">{title}</p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
            Amount released
          </p>
          <Money amount={amountUsd} size="lg" className="mt-1" />
        </div>
        {(payeeCount != null || eventCount != null) && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {payeeCount != null && (
              <div>
                <p className="text-[11px] uppercase text-resolve-muted">Payees</p>
                <p className="tabular-nums font-medium text-white">{payeeCount}</p>
              </div>
            )}
            {eventCount != null && (
              <div>
                <p className="text-[11px] uppercase text-resolve-muted">Events</p>
                <p className="tabular-nums font-medium text-white">{eventCount}</p>
              </div>
            )}
          </div>
        )}
        {txHash && (
          <div>
            <p className="text-[11px] uppercase text-resolve-muted">Transaction</p>
            <MonoHash value={txHash} className="mt-1 block" />
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-resolve-border-strong bg-resolve-hover px-3 py-2 text-xs font-medium text-white hover:border-resolve-accent/40"
            >
              View on Arcscan
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {complianceCsv && (
            <button
              type="button"
              onClick={() => {
                if (onDownload) {
                  onDownload();
                  return;
                }
                const blob = new Blob([complianceCsv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "resolve-compliance.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-resolve-border-strong bg-resolve-hover px-3 py-2 text-xs font-medium text-white hover:border-resolve-accent/40"
            >
              Compliance CSV
              <Download className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
