"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Percent, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { Button } from "@/components/resolve/ui/button";
import {
  buildMissionBlueprintFromScope,
  simulateBlueprintPackage,
  type MissionBlueprintPackage,
} from "@/lib/mission/mission-blueprint-package";
import { createReportFromPackage, saveMissionReport } from "@/lib/mission/mission-report-store";
import { authorizeBlueprintServer, prepareBlueprintSettlement } from "@/lib/mission/mission-report-api";
import { resolveMissionCommunitySlug } from "@/lib/mission/mission-community-slug";
import { useFundingWalletChoice } from "@/hooks/use-funding-wallet-choice";
import { useFundProgramExecution } from "@/hooks/use-fund-program-execution";
import { PayFromWalletSection } from "@/components/resolve/fund/pay-from-wallet-section";
import { fundingSourceLabel } from "@/lib/wallet/funding-source";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";

type PayeeRow = { id: string; label: string; percent: number };

function parsePayeesFromText(text: string): PayeeRow[] {
  const rows: PayeeRow[] = [];
  const re = /([A-Za-z0-9@._-]+)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    rows.push({ id: `p-${i++}`, label: m[1]!, percent: Number(m[2]) });
  }
  return rows;
}

/** Private community batch — PDF evidence + funder-set % → Arc memo payout. */
export function MissionBatchAllocationPanel({
  prompt,
  communitySlug: communitySlugProp,
  initialBudgetUsd,
}: {
  prompt: string;
  communitySlug?: string | null;
  initialBudgetUsd?: number;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const fileRef = useRef<HTMLInputElement>(null);
  const slug =
    communitySlugProp ??
    resolveMissionCommunitySlug({ scopeLabel: prompt, topicName: prompt }) ??
    "react";

  const [budgetUsd, setBudgetUsd] = useState(initialBudgetUsd ?? 500);
  const [extractedText, setExtractedText] = useState("");
  const [payees, setPayees] = useState<PayeeRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  const fundAmount = Math.max(5, Math.round(budgetUsd));
  const walletChoice = useFundingWalletChoice(fundAmount);
  const { executeFund } = useFundProgramExecution(slug);

  const totalPercent = payees.reduce((s, p) => s + p.percent, 0);

  const pkg = useMemo((): MissionBlueprintPackage => {
    const base = buildMissionBlueprintFromScope({
      prompt,
      communitySlug: slug,
      budgetUsd,
      policy: "balanced",
      milestoneUsd: budgetUsd,
    });
    const owedRows = payees.map((p) => ({
      label: p.label,
      owedUsd: Math.round((budgetUsd * p.percent) / 100 * 100) / 100,
      source: "Batch plan (Mission)",
    }));
    return {
      ...base,
      payees: owedRows.length ? owedRows : base.payees,
      totalCapitalUsd: budgetUsd,
      rationale:
        "Private batch allocation from operator PDF/memo — not the communal Discover pool.",
    };
  }, [prompt, slug, budgetUsd, payees]);

  const simulation = useMemo(() => simulateBlueprintPackage(pkg), [pkg]);

  const uploadPdf = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/evidence/upload", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string; extractedText?: string; text?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const text = data.extractedText ?? data.text ?? "";
      setExtractedText(text.slice(0, 4000));
      const parsed = parsePayeesFromText(text);
      if (parsed.length) {
        setPayees(parsed);
        toast.success("PDF read — payees extracted", {
          description: `${parsed.length} rows — adjust % before execute`,
        });
      } else {
        toast.message("PDF uploaded", {
          description: "Add payee rows manually or paste “Name 40%” lines",
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  function addPayee() {
    setPayees((prev) => [...prev, { id: `p-${Date.now()}`, label: "", percent: 0 }]);
    setSimulated(false);
  }

  function updatePayee(id: string, patch: Partial<PayeeRow>) {
    setPayees((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSimulated(false);
  }

  async function handleSimulate() {
    if (payees.length < 1) {
      toast.error("Add at least one payee");
      return;
    }
    if (Math.abs(totalPercent - 100) > 0.5) {
      toast.error("Percentages must sum to 100%", { description: `Currently ${totalPercent.toFixed(1)}%` });
      return;
    }
    const record = createReportFromPackage(pkg, "simulated");
    saveMissionReport(record);
    setSimulated(true);
    toast.success("Batch simulated", {
      description: `$${simulation.totalPayeeUsd.toFixed(2)} · ${payees.length} payees`,
    });
  }

  async function handleExecute() {
    if (!simulated) {
      toast.error("Simulate the batch first");
      return;
    }
    if (!user) {
      openSignIn();
      return;
    }
    setAuthorizing(true);
    try {
      let skipFund = false;
      try {
        const source = walletChoice.assertFundingSource();
        if (source === "external" && pkg.programId) {
          await executeFund(
            {
              programId: pkg.programId,
              amountUsd: fundAmount,
              communitySlug: slug,
              label: "Mission batch",
            },
            source,
          );
          skipFund = true;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Pick a wallet to pay from");
        return;
      }

      const preview = await prepareBlueprintSettlement(pkg);
      const result = await authorizeBlueprintServer({
        pkg,
        amountUsd: fundAmount,
        skipFund,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Batch payout failed", {
          description: preview ? `Batch ${preview.batchHash}` : undefined,
        });
        return;
      }
      const record = createReportFromPackage(pkg, "authorized", {
        fundTxLabel: result.fundTxLabel,
      });
      saveMissionReport(record);
      const paidFrom = walletChoice.fundingSource;
      toast.success("Arc batch submitted", {
        description: paidFrom
          ? `${result.fundTxLabel ?? "Submitted"} · ${fundingSourceLabel(paidFrom)}`
          : result.fundTxLabel,
      });
      router.push(`/mission/report/${pkg.id}`);
    } finally {
      setAuthorizing(false);
    }
  }

  return (
    <DiscoverCapitalCard as="section" accent="violet" className="sm:p-5">
      <div data-testid="mission-batch-allocation-panel">
      <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.2em]">
        Private batch payout
      </p>
      <h3 className="mt-1 text-base font-semibold text-white">
        Your community · Arc memo batch
      </h3>
      <p className="mt-2 text-sm text-resolve-muted">
        Upload a PDF (board resolution, payroll memo). Set who gets what %. This pays{" "}
        <span className="text-white/90">your</span> list — not the communal Discover pool.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf"
          className="hidden"
          onChange={(e) => void uploadPdf(e.target.files)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          Upload PDF
        </Button>
        <label className="text-xs text-resolve-muted">
          Batch total (USDC)
          <input
            type="number"
            min={5}
            step={50}
            value={budgetUsd}
            onChange={(e) => {
              setBudgetUsd(Number(e.target.value));
              setSimulated(false);
            }}
            className="ml-2 w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white"
          />
        </label>
      </div>

      {extractedText && (
        <details className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
          <summary className="cursor-pointer text-resolve-muted">Extracted text</summary>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-resolve-muted-dim">
            {extractedText.slice(0, 2000)}
          </pre>
        </details>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
            Payees · must total 100%
          </p>
          <button type="button" onClick={addPayee} className="text-xs text-sky-300 hover:underline">
            + Add row
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {payees.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <input
                value={p.label}
                onChange={(e) => updatePayee(p.id, { label: e.target.value })}
                placeholder="Payee name or wallet"
                className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              />
              <span className="flex items-center gap-1 text-sm text-resolve-muted">
                <Percent className="h-3 w-3" />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={p.percent || ""}
                  onChange={(e) => updatePayee(p.id, { percent: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                />
              </span>
              <span className="text-xs tabular-nums text-emerald-300">
                ${((budgetUsd * p.percent) / 100).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <p
          className={`mt-2 text-xs ${Math.abs(totalPercent - 100) < 0.5 ? "text-emerald-300" : "text-amber-300"}`}
        >
          Total: {totalPercent.toFixed(1)}%
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {simulated && user && (
          <PayFromWalletSection
            amountUsd={fundAmount}
            disabled={authorizing}
            choice={walletChoice}
            className="w-full basis-full"
          />
        )}
        <Button type="button" variant="secondary" size="sm" onClick={() => void handleSimulate()}>
          Simulate batch
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={authorizing || !simulated}
          onClick={() => void handleExecute()}
        >
          {authorizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Shield className="h-3.5 w-3.5" />
          )}
          Execute Arc batch
        </Button>
      </div>
      </div>
    </DiscoverCapitalCard>
  );
}
