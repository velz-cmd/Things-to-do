"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FileUp, Loader2, Percent, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { Button } from "@/components/resolve/ui/button";
import { PayFromWalletSection } from "@/components/resolve/fund/pay-from-wallet-section";
import { useFundingWalletChoice } from "@/hooks/use-funding-wallet-choice";
import { createReportFromPackage, saveMissionReport } from "@/lib/mission/mission-report-store";
import {
  buildMissionBlueprintFromScope,
  simulateBlueprintPackage,
  type MissionBlueprintPackage,
} from "@/lib/mission/mission-blueprint-package";

type PayeeRow = { id: string; label: string; percent: number };

function parsePayeesFromText(text: string): PayeeRow[] {
  const rows: PayeeRow[] = [];
  const re = /([A-Za-z0-9@._:-]+)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    rows.push({ id: `p-${i++}`, label: m[1]!, percent: Number(m[2]) });
  }
  return rows;
}

const POOL_KEY = "resolve-personal-pool-v1";

function loadPoolPrefs(): { name: string; milestoneUsd: number } {
  if (typeof window === "undefined") return { name: "My pool", milestoneUsd: 500 };
  try {
    const raw = localStorage.getItem(POOL_KEY);
    if (!raw) return { name: "My pool", milestoneUsd: 500 };
    const p = JSON.parse(raw) as { name?: string; milestoneUsd?: number };
    return {
      name: p.name?.trim() || "My pool",
      milestoneUsd: p.milestoneUsd && p.milestoneUsd >= 5 ? p.milestoneUsd : 500,
    };
  } catch {
    return { name: "My pool", milestoneUsd: 500 };
  }
}

function savePoolPrefs(name: string, milestoneUsd: number) {
  try {
    localStorage.setItem(POOL_KEY, JSON.stringify({ name, milestoneUsd }));
  } catch {
    /* ignore */
  }
}

/**
 * Personal pool — you are the owner. Not linked to Discover communal pools.
 * PDF is evidence for your payee list; you set pool size, milestone, and batch %.
 */
export function MissionPersonalPoolPanel({
  prompt,
  initialBudgetUsd,
}: {
  prompt: string;
  initialBudgetUsd?: number;
}) {
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const fileRef = useRef<HTMLInputElement>(null);
  const prefs = loadPoolPrefs();

  const [poolName, setPoolName] = useState(prefs.name);
  const [poolSizeUsd, setPoolSizeUsd] = useState(initialBudgetUsd ?? 5000);
  const [milestoneUsd, setMilestoneUsd] = useState(prefs.milestoneUsd);
  const [extractedText, setExtractedText] = useState("");
  const [payees, setPayees] = useState<PayeeRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [executing, setExecuting] = useState(false);

  const batchTotalUsd = useMemo(() => {
    return payees.reduce(
      (s, p) => s + Math.round((poolSizeUsd * p.percent) / 100 * 100) / 100,
      0,
    );
  }, [payees, poolSizeUsd]);

  const walletChoice = useFundingWalletChoice(Math.max(batchTotalUsd, 5));

  const pkg = useMemo((): MissionBlueprintPackage => {
    const base = buildMissionBlueprintFromScope({
      prompt: `${poolName} · ${prompt}`,
      communitySlug: "personal",
      budgetUsd: poolSizeUsd,
      policy: "balanced",
      milestoneUsd,
    });
    const owedRows = payees.map((p) => ({
      label: p.label,
      owedUsd: Math.round((poolSizeUsd * p.percent) / 100 * 100) / 100,
      source: "Personal pool batch",
    }));
    return {
      ...base,
      payees: owedRows.length ? owedRows : base.payees,
      totalCapitalUsd: poolSizeUsd,
      rationale: "Personal pool — your milestone, your payee list, not the Discover communal ledger.",
    };
  }, [prompt, poolName, poolSizeUsd, milestoneUsd, payees]);

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
          description: `${parsed.length} rows — adjust % before batch`,
        });
      } else {
        toast.message("PDF uploaded", {
          description: "Add payee rows or paste “name@org 40%” / “0x… 25%” lines",
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
    if (Math.abs(payees.reduce((s, p) => s + p.percent, 0) - 100) > 0.5) {
      toast.error("Percentages must sum to 100%");
      return;
    }
    savePoolPrefs(poolName, milestoneUsd);
    const record = createReportFromPackage(pkg, "simulated");
    saveMissionReport(record);
    setSimulated(true);
    toast.success("Batch simulated", {
      description: `$${simulation.totalPayeeUsd.toFixed(2)} · ${payees.length} payees · milestone $${milestoneUsd}`,
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
    try {
      walletChoice.assertFundingSource();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pick a wallet to pay from");
      return;
    }

    setExecuting(true);
    try {
      const res = await fetch("/api/mission/personal-pool/execute", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolName,
          payees: payees.map((p) => ({
            label: p.label,
            amountUsd: Math.round((poolSizeUsd * p.percent) / 100 * 100) / 100,
          })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        transfers?: Array<{ txHash: string; label: string }>;
        skipped?: string[];
        message?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Batch failed", {
          description: data.skipped?.length
            ? `Missing wallet on: ${data.skipped.slice(0, 3).join(", ")}`
            : undefined,
        });
        return;
      }
      const record = createReportFromPackage(pkg, "authorized", {
        fundTxLabel: data.transfers?.[0]?.txHash
          ? `Personal batch · ${data.transfers[0].txHash.slice(0, 10)}…`
          : "Personal pool batch",
      });
      saveMissionReport(record);
      toast.success(data.message ?? "Arc batch sent", {
        description:
          data.skipped?.length ?
            `${data.skipped.length} row(s) skipped — need 0x wallet in label`
          : undefined,
      });
    } finally {
      setExecuting(false);
    }
  }

  const totalPercent = payees.reduce((s, p) => s + p.percent, 0);

  return (
    <section
      className="rounded-2xl border border-violet-500/25 bg-[#0c1220]/90 p-4 sm:p-5"
      data-testid="mission-personal-pool-panel"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
        Personal pool
      </p>
      <h3 className="mt-1 text-base font-semibold text-white">Batch payout</h3>
      <p className="mt-2 text-sm text-resolve-muted">
        You own this pool — set size and milestone, upload a PDF for your payee list, split by %, then
        execute Arc transfers.{" "}
        <span className="text-white/90">Not</span> linked to Discover communal pools.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-resolve-muted">
          Pool name
          <input
            value={poolName}
            onChange={(e) => {
              setPoolName(e.target.value);
              setSimulated(false);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-resolve-muted">
          Pool size (USDC)
          <input
            type="number"
            min={5}
            step={100}
            value={poolSizeUsd}
            onChange={(e) => {
              setPoolSizeUsd(Number(e.target.value));
              setSimulated(false);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-resolve-muted">
          Milestone (USDC)
          <input
            type="number"
            min={5}
            step={50}
            value={milestoneUsd}
            onChange={(e) => {
              setMilestoneUsd(Number(e.target.value));
              setSimulated(false);
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>

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
          Upload PDF (payee list)
        </Button>
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
            Payees · 0x wallet or name · must total 100%
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
                placeholder="0x… or payee id"
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
                ${((poolSizeUsd * p.percent) / 100).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <p
          className={`mt-2 text-xs ${Math.abs(totalPercent - 100) < 0.5 ? "text-emerald-300" : "text-amber-300"}`}
        >
          Total: {totalPercent.toFixed(1)}% · batch ${batchTotalUsd.toFixed(2)}
        </p>
      </div>

      {simulated && user && (
        <PayFromWalletSection
          amountUsd={Math.max(batchTotalUsd, 5)}
          disabled={executing}
          choice={walletChoice}
          className="mt-4"
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void handleSimulate()}>
          Simulate batch
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={executing || !simulated}
          onClick={() => void handleExecute()}
        >
          {executing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Shield className="h-3.5 w-3.5" />
          )}
          Execute Arc batch
        </Button>
      </div>
    </section>
  );
}

/** @deprecated use MissionPersonalPoolPanel */
export const MissionBatchAllocationPanel = MissionPersonalPoolPanel;
