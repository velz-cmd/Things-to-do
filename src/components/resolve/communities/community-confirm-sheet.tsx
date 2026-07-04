"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";

export type CommunityConfirmRequest =
  | {
      kind: "create_program";
      title: string;
      detail: string;
      communityName: string;
      templateLabel: string;
    }
  | {
      kind: "deploy";
      title: string;
      detail: string;
      programName: string;
      pendingUsd: number;
      payeeCount: number;
      canDeploy: boolean;
      blockReason?: string;
    }
  | {
      kind: "approve_payouts";
      title: string;
      detail: string;
      programName: string;
      pendingUsd: number;
      needsFund: boolean;
      fundingGapUsd: number;
      canDeploy: boolean;
    };

type Props = {
  open: boolean;
  request: CommunityConfirmRequest | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CommunityConfirmSheet({
  open,
  request,
  busy,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !request) return null;

  const blocked =
    request.kind === "deploy"
      ? !request.canDeploy
      : request.kind === "approve_payouts"
        ? !request.canDeploy && !request.needsFund
        : false;

  const confirmLabel =
    request.kind === "create_program"
      ? "Create Draft Program"
      : request.kind === "deploy"
        ? "Settle on Arc"
        : request.needsFund
          ? `Fund $${request.fundingGapUsd.toFixed(2)} Gap`
          : "Settle on Arc";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f18] p-5 shadow-2xl"
      >
        <p className="text-sm font-semibold text-white">{request.title}</p>
        <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{request.detail}</p>

        {request.kind === "create_program" && (
          <div className="mt-3 grid gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-xs">
            <p className="text-resolve-muted">
              Community: <span className="text-white">{request.communityName}</span>
            </p>
            <p className="text-resolve-muted">
              Draft rule: <span className="text-white">{request.templateLabel}</span>
            </p>
            <p className="text-resolve-muted">
              Next step:{" "}
              <span className="text-white">fund pool or edit rules before settlement</span>
            </p>
          </div>
        )}

        {(request.kind === "deploy" || request.kind === "approve_payouts") && (
          <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-xs">
            <p className="text-resolve-muted">
              Program: <span className="text-white">{request.programName}</span>
            </p>
            <p className="mt-1 text-resolve-muted">
              Pending:{" "}
              <Money amount={request.pendingUsd} size="sm" className="inline text-amber-100" />
              {request.kind === "deploy" && (
                <span className="ml-2 text-resolve-muted-dim">- {request.payeeCount} payee(s)</span>
              )}
            </p>
            {request.kind === "approve_payouts" && request.needsFund && (
              <p className="mt-1 text-amber-100">
                Funding gap:{" "}
                <Money amount={request.fundingGapUsd} size="sm" className="inline" />
              </p>
            )}
          </div>
        )}

        {request.kind === "deploy" && request.blockReason && !request.canDeploy && (
          <p className="mt-2 text-[11px] font-medium text-amber-200/90">{request.blockReason}</p>
        )}

        <p className="mt-3 text-[10px] text-resolve-muted-dim">
          Writes to the RESOLVE ledger and mission timeline with the same audit trail as Discover.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={busy || blocked}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
