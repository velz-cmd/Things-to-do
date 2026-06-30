"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Gavel, Loader2 } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import { GOVERNANCE_PRINCIPLES, createProposalDraft } from "@/lib/economy/governance";

type Props = {
  signedIn?: boolean;
  communitySlug?: string;
};

export function DaoGovernancePanel({ signedIn, communitySlug = "open-research" }: Props) {
  const [title, setTitle] = useState("Increase docs bounty pool");
  const [budget, setBudget] = useState("500");
  const [exporting, setExporting] = useState(false);

  async function exportProposal() {
    setExporting(true);
    try {
      const draft = createProposalDraft({
        title,
        communitySlug,
        budgetUsd: Number(budget) || undefined,
        policyPatch: {
          templateId: "docs-bounty",
          rules: { perMergeUsd: 5 },
        },
      });

      const blob = new Blob([JSON.stringify(draft, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resolve-proposal-${draft.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Proposal draft exported — share with your DAO");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-violet-300" />
        <p className="text-sm font-semibold text-white">DAO governance (Phase adv-8)</p>
      </div>
      <p className="mt-1 text-xs text-resolve-muted">
        Governance chooses policy and budget. RESOLVE executes rules on the ledger — votes never
        pick individual payees.
      </p>

      <ul className="mt-3 space-y-1.5">
        {GOVERNANCE_PRINCIPLES.map((p) => (
          <li key={p} className="text-[11px] text-resolve-muted">
            · {p}
          </li>
        ))}
      </ul>

      {signedIn && (
        <div className="mt-4 space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div>
            <label className="text-[10px] uppercase text-resolve-muted-dim">Proposal title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-resolve-muted-dim">Budget (USD)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 w-32 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
          </div>
          <Button size="sm" onClick={() => void exportProposal()} disabled={exporting}>
            {exporting ?
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : "Export proposal draft"}
          </Button>
          <p className="text-[10px] text-resolve-muted-dim">
            On-chain voting and policy binding ship in adv-8. Export is compatible with Snapshot-style
            workflows today.
          </p>
        </div>
      )}
    </div>
  );
}
