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
      ? "Create program"
      : request.kind === "deploy"
        ? "Deploy on Arc"
        : request.needsFund
          ? "Fund pool first"
          : "Deploy on Arc";

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
          <p className="mt-2 text-[11px] text-resolve-muted-dim">
            {request.communityName} · {request.templateLabel}
          </p>
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
                <span className="ml-2 text-resolve-muted-dim">· {request.payeeCount} payee(s)</span>
              )}
            </p>
          </div>
        )}

        {request.kind === "deploy" && request.blockReason && !request.canDeploy && (
          <p className="mt-2 text-[11px] font-medium text-amber-200/90">{request.blockReason}</p>
        )}

        <p className="mt-3 text-[10px] text-resolve-muted-dim">
          Writes to ledger and mission timeline — same audit trail as Discover actions.
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
