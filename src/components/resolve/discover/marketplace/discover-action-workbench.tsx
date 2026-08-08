"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, WalletCards, X } from "lucide-react";
import { isAddress } from "viem";
import type {
  DiscoverAction,
  DiscoverPageData,
  EconomicActionItem,
} from "@/lib/discover/marketplace/contracts";
import type { FundingSource } from "@/lib/wallet/funding-source";
import { useSpendableUsd } from "@/hooks/use-spendable-usd";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { useFundProgramExecution } from "@/hooks/use-fund-program-execution";
import { FundProgressPanel } from "@/components/resolve/fund/fund-progress-panel";
import { WalletSourcePicker } from "@/components/resolve/fund/wallet-source-picker";
import { PayoutDestinationDrawer } from "@/components/resolve/profile/payout-destination-drawer";
import type { CapitalAuthorizationSummary, CapitalBootstrap } from "@/lib/capital/bootstrap";

type Props = {
  action: DiscoverAction | null;
  item?: EconomicActionItem;
  data: DiscoverPageData;
  onClose: () => void;
};

type DirectSupportPreflight = {
  destinationAddress: string;
  recipientLabel: string;
  network: string;
  asset: string;
  verifiedAt: string | null;
};

type DirectSupportReceipt = {
  receiptId: string;
  receiptReference: string;
  receiptUrl: string;
  explorerUrl: string;
  txHash: string;
  amountUsd: number;
  destinationAddress: string;
};

function titleFor(action: DiscoverAction) {
  if (action.presentation.kind !== "workbench") return action.label;
  switch (action.presentation.target.panel) {
    case "direct_support": return `Support ${action.presentation.target.recipientLabel}`;
    case "pool_funding": return `Fund ${action.presentation.target.poolName}`;
    case "payout_destination": return "Choose payout destination";
    case "program_setup": return "Complete program readiness";
    case "source_sync": return "Refresh GitHub evidence";
    case "authorization_review": return "Review funding authorization";
    case "receipt": return "Confirmed receipt";
    case "evidence": return "Inspect evidence";
  }
}

function WalletSummary({ source }: { source: FundingSource | null }) {
  const spendable = useSpendableUsd();
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs">
      <p className="font-medium text-white">Funding wallet must be chosen explicitly</p>
      <dl className="mt-2 grid grid-cols-[130px_1fr] gap-y-2">
        <dt className="text-slate-500">RESOLVE wallet</dt>
        <dd className="text-slate-200">${spendable.appSpendableUsd.toFixed(2)} USDC</dd>
        <dt className="text-slate-500">Connected wallet</dt>
        <dd className="text-slate-200">{spendable.externalLinked || spendable.externalReady ? `$${spendable.externalSpendableUsd.toFixed(2)} USDC` : "Not linked"}</dd>
        <dt className="text-slate-500">Current choice</dt>
        <dd className="capitalize text-slate-200">{source ?? "No wallet selected"}</dd>
      </dl>
    </div>
  );
}

function DirectSupportPanel({ action, onClose, signedIn }: { action: DiscoverAction; onClose: () => void; signedIn: boolean }) {
  const router = useRouter();
  const spendable = useSpendableUsd();
  const { externalWalletReady, openConnectWallet, sendDirectSupportWithWallet } = useResolveAccess();
  const target = action.presentation.kind === "workbench" && action.presentation.target.panel === "direct_support"
    ? action.presentation.target
    : null;
  const [preflight, setPreflight] = useState<DirectSupportPreflight | null>(null);
  const [source, setSource] = useState<FundingSource | null>(null);
  const [amount, setAmount] = useState("5");
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState("Checking verified recipient");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<DirectSupportReceipt | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submittedTxHash, setSubmittedTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    setPreflight(null);
    setError(null);
    setIdempotencyKey(crypto.randomUUID());
    setSubmittedTxHash(null);
    void fetch(`/api/wallet/send?recipientUserId=${encodeURIComponent(target.recipientUserId)}`, {
      credentials: "include",
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as DirectSupportPreflight & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Recipient verification failed");
      setPreflight(body);
      setStage("Ready for wallet selection");
    }).catch((reason) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Recipient verification failed");
    });
    return () => controller.abort();
  }, [target]);

  if (!target) return null;
  const amountUsd = Number(amount);
  const chosenBalance = source === "app" ? spendable.appSpendableUsd : source === "external" ? spendable.externalSpendableUsd : 0;
  const canConfirm = Boolean(signedIn && preflight && source && Number.isFinite(amountUsd) && amountUsd >= 0.01 && (submittedTxHash || chosenBalance >= amountUsd) && !pending);

  async function confirm() {
    if (!target || !preflight || !source || !canConfirm) return;
    setPending(true);
    setError(null);
    setReceipt(null);
    const operationKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(operationKey);
    let operationTxHash = submittedTxHash ?? undefined;
    try {
      let txHash: string | undefined = operationTxHash;
      if (source === "external") {
        if (!externalWalletReady) {
          openConnectWallet();
          throw new Error("Reconnect the linked wallet, then confirm again.");
        }
        if (!isAddress(preflight.destinationAddress)) throw new Error("The verified payout address is invalid.");
        if (!txHash) {
          const result = await sendDirectSupportWithWallet(
            preflight.destinationAddress,
            amountUsd,
            {
              onStage: (next, broadcastHash) => {
                setStage(next.replaceAll("_", " "));
                if (broadcastHash) {
                  operationTxHash = broadcastHash;
                  setSubmittedTxHash(broadcastHash);
                }
              },
            },
          );
          txHash = result.txHash;
          operationTxHash = result.txHash;
          setSubmittedTxHash(result.txHash);
        }
        setStage("Recording confirmed support and receipt");
      } else {
        setStage("Submitting through the RESOLVE wallet");
      }
      const response = await fetch("/api/wallet/send", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientUserId: target.recipientUserId,
          amountUsd,
          idempotencyKey: operationKey,
          fundingSource: source,
          txHash,
        }),
      });
      const body = await response.json().catch(() => ({})) as Partial<DirectSupportReceipt> & { error?: string; retryable?: boolean };
      if (response.status === 202 && !body.receiptId) {
        if (body.txHash) {
          operationTxHash = body.txHash;
          setSubmittedTxHash(body.txHash);
        }
        throw new Error(body.error ?? "The transfer is awaiting safe receipt reconciliation.");
      }
      if (!response.ok) throw new Error(body.error ?? "Direct support did not complete");
      if (!body.receiptId || !body.receiptReference || !body.receiptUrl || !body.explorerUrl || !body.txHash || typeof body.amountUsd !== "number" || !body.destinationAddress) {
        throw new Error("The confirmed support response did not include a complete receipt.");
      }
      setReceipt(body as DirectSupportReceipt);
      setStage("Confirmed on Arc and recorded by RESOLVE");
      await spendable.refresh().catch(() => null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Direct support did not complete");
      if (!operationTxHash) setIdempotencyKey(crypto.randomUUID());
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
        <div className="flex items-center gap-2 text-emerald-200"><CheckCircle2 className="h-5 w-5" /><strong>Support confirmed</strong></div>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-xs">
          <dt className="text-slate-500">Amount</dt><dd className="text-white">${receipt.amountUsd.toFixed(2)} USDC</dd>
          <dt className="text-slate-500">Recipient</dt><dd className="text-white">{target.recipientLabel}</dd>
          <dt className="text-slate-500">Receipt</dt><dd className="break-all text-white">{receipt.receiptReference}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={receipt.receiptUrl} className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white">Open receipt</a>
          <a href={receipt.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">ArcScan<ExternalLink className="h-3.5 w-3.5" /></a>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-xs">
        <div className="flex items-center gap-2 text-cyan-200"><ShieldCheck className="h-4 w-4" />Verified recipient preflight</div>
        {preflight ? <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2"><dt className="text-slate-500">Recipient</dt><dd className="text-white">{preflight.recipientLabel}</dd><dt className="text-slate-500">Destination</dt><dd className="break-all font-mono text-white">{preflight.destinationAddress}</dd><dt className="text-slate-500">Network</dt><dd className="text-white">{preflight.network} {preflight.asset}</dd></dl> : <p className="mt-3 text-slate-400">{stage}</p>}
      </div>
      <label className="block text-xs text-slate-400">Amount in USDC<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={pending || Boolean(submittedTxHash)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
      <WalletSummary source={source} />
      <WalletSourcePicker appUsd={spendable.appSpendableUsd} extUsd={spendable.externalSpendableUsd} amountUsd={amountUsd} externalReady={externalWalletReady} hasLinkedExternal={spendable.externalLinked} value={source} onChange={setSource} disabled={pending || Boolean(submittedTxHash)} onReconnectExternal={openConnectWallet} />
      {!spendable.externalLinked && !externalWalletReady ? <button type="button" onClick={() => setSource("app")} aria-pressed={source === "app"} className={`w-full rounded-lg border p-3 text-left text-xs ${source === "app" ? "border-violet-300/50 bg-violet-400/10 text-white" : "border-white/10 text-slate-300"}`}><strong>RESOLVE wallet</strong><span className="mt-1 block">${spendable.appSpendableUsd.toFixed(2)} USDC on Arc</span></button> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      {pending ? <p aria-live="polite" className="flex items-center gap-2 text-sm text-violet-200"><LoaderCircle className="h-4 w-4 animate-spin" />{stage}</p> : null}
      <button type="button" disabled={!canConfirm} onClick={() => void confirm()} className="w-full rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submittedTxHash ? "Retry receipt recording" : `Confirm $${Number.isFinite(amountUsd) ? amountUsd.toFixed(2) : "0.00"} USDC support`}</button>
    </div>
  );
}

function PoolFundingPanel({ action, signedIn }: { action: DiscoverAction; signedIn: boolean }) {
  const target = action.presentation.kind === "workbench" && action.presentation.target.panel === "pool_funding" ? action.presentation.target : null;
  const { executeFund, fundProgress, resetFundProgress, externalWalletReady, spendable } = useFundProgramExecution(target?.communitySlug);
  const { openConnectWallet } = useResolveAccess();
  const [source, setSource] = useState<FundingSource | null>(null);
  const [amount, setAmount] = useState("5");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { resetFundProgress(); setSource(null); setError(null); }, [resetFundProgress, target?.subjectId]);
  if (!target) return null;
  const currentTarget = target;
  const amountUsd = Number(amount);
  const selectedBalance = source === "app" ? spendable.appSpendableUsd : source === "external" ? spendable.externalSpendableUsd : 0;
  const canFund = Boolean(signedIn && source && amountUsd >= 5 && selectedBalance >= amountUsd && !pending && target.programId);
  async function confirm() {
    if (!canFund || !source) return;
    setPending(true);
    setError(null);
    try {
      await executeFund({ programId: currentTarget.programId, communitySlug: currentTarget.communitySlug, label: currentTarget.poolName, amountUsd }, source);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pool funding did not complete");
    } finally {
      setPending(false);
    }
  }
  return <div className="mt-5 space-y-4"><div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-xs"><dl className="grid grid-cols-[120px_1fr] gap-y-2"><dt className="text-slate-500">Pool</dt><dd className="text-white">{target.poolName}</dd><dt className="text-slate-500">Community</dt><dd className="text-white">{target.communitySlug}</dd><dt className="text-slate-500">Network</dt><dd className="text-white">Arc Testnet USDC</dd><dt className="text-slate-500">Program</dt><dd className="break-all text-white">{target.programId}</dd></dl></div><label className="block text-xs text-slate-400">Amount in USDC<input type="number" min="5" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={pending} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label><WalletSummary source={source} /><WalletSourcePicker appUsd={spendable.appSpendableUsd} extUsd={spendable.externalSpendableUsd} amountUsd={amountUsd} externalReady={externalWalletReady} hasLinkedExternal={spendable.externalLinked} value={source} onChange={setSource} disabled={pending} onReconnectExternal={openConnectWallet} />{!spendable.externalLinked && !externalWalletReady ? <button type="button" onClick={() => setSource("app")} aria-pressed={source === "app"} className={`w-full rounded-lg border p-3 text-left text-xs ${source === "app" ? "border-violet-300/50 bg-violet-400/10 text-white" : "border-white/10 text-slate-300"}`}><strong>RESOLVE wallet</strong><span className="mt-1 block">${spendable.appSpendableUsd.toFixed(2)} USDC on Arc</span></button> : null}<FundProgressPanel stage={fundProgress.stage} fundingSource={fundProgress.fundingSource ?? source ?? "app"} amountUsd={fundProgress.amountUsd ?? amountUsd} txHash={fundProgress.txHash} />{error ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error}</p> : null}<button type="button" disabled={!canFund || fundProgress.stage === "complete"} onClick={() => void confirm()} className="w-full rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{fundProgress.stage === "complete" ? "Funding confirmed" : `Review and fund $${Number.isFinite(amountUsd) ? amountUsd.toFixed(2) : "0.00"} USDC`}</button></div>;
}

function SourceSyncPanel({ action }: { action: DiscoverAction }) {
  const router = useRouter();
  const target = action.presentation.kind === "workbench" && action.presentation.target.panel === "source_sync" ? action.presentation.target : null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!target) return null;
  async function sync() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/profile/connections", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ provider: target!.provider }) });
      const body = await response.json().catch(() => ({})) as { error?: string; ingested?: number };
      if (!response.ok) throw new Error(body.error ?? "Source refresh was not accepted");
      setMessage(`GitHub refresh completed${typeof body.ingested === "number" ? `, ${body.ingested} records ingested` : ""}.`);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Source refresh failed"); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 space-y-4"><div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-slate-300"><p>Refresh the persisted GitHub connection and evidence state. Existing records remain visible if the provider fails.</p>{target.repository ? <p className="mt-2 font-mono text-xs text-white">{target.repository}</p> : null}</div>{message ? <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-2 text-sm text-emerald-100">{message}</p> : null}{error ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error}</p> : null}<button type="button" disabled={busy} onClick={() => void sync()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh GitHub state</button></div>;
}

function ProgramSetupPanel({ action, item }: { action: DiscoverAction; item?: EconomicActionItem }) {
  const router = useRouter();
  const target = action.presentation.kind === "workbench" && action.presentation.target.panel === "program_setup" ? action.presentation.target : null;
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("docs-bounty");
  const [budgetUsd, setBudgetUsd] = useState("100");
  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [allocationRule, setAllocationRule] = useState("verified_activity");
  const [eligibilityMode, setEligibilityMode] = useState("resolved_only");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!target) return null;

  async function submit() {
    setBusy(true); setError(null); setMessage(null);
    try {
      if (target!.step === "review") {
        setMessage("The current persisted program state was reviewed. No lifecycle change was submitted.");
        router.refresh();
        return;
      }
      let response: Response;
      if (target!.step === "create") {
        const budget = Number(budgetUsd);
        if (!name.trim() || !Number.isFinite(budget) || budget <= 0) throw new Error("Enter a program name and positive budget target.");
        response = await fetch(`/api/communities/${encodeURIComponent(target!.communitySlug)}/programs`, {
          method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({ name: name.trim(), templateId, budgetUsd: budget }),
        });
      } else if (target!.step === "source") {
        response = await fetch("/api/profile/connections", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ provider: "github" }) });
      } else {
        if (!target!.programId) throw new Error("No persisted program is available for this setup step.");
        const body = target!.step === "publication"
          ? { setup: { publicationStatus: "approved" } }
          : target!.step === "policy"
            ? { rules: { allocationRule, eligibilityMode }, setup: { policyStatus: "active" } }
            : target!.step === "treasury"
              ? isAddress(treasuryAddress)
                ? { setup: { treasuryAddress } }
                : (() => { throw new Error("Enter a valid Arc treasury address."); })()
              : {};
        response = await fetch(`/api/communities/${encodeURIComponent(target!.communitySlug)}/programs/${encodeURIComponent(target!.programId)}`, {
          method: "PATCH", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body),
        });
      }
      const payload = await response.json().catch(() => ({})) as { error?: string; program?: { id?: string } };
      if (!response.ok) throw new Error(payload.error ?? "Program setup did not complete");
      setMessage(target!.step === "create" ? "Program draft created. Its next persisted prerequisite will appear after refresh." : `${target!.step.replaceAll("_", " ")} completed.`);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Program setup did not complete"); }
    finally { setBusy(false); }
  }

  return <div className="mt-5 space-y-4"><div className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><dl className="grid grid-cols-[120px_1fr] gap-y-2 text-xs"><dt className="text-slate-500">Community</dt><dd className="text-white">{target.communitySlug}</dd><dt className="text-slate-500">Program</dt><dd className="break-all text-white">{target.programId ?? "No program exists yet"}</dd><dt className="text-slate-500">Required step</dt><dd className="capitalize text-white">{target.step}</dd></dl>{item?.blocker ? <p className="mt-4 text-sm leading-6 text-amber-100">{item.blocker}</p> : null}</div>{target.step === "create" ? <div className="space-y-3"><label className="block text-xs text-slate-400">Program name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label><label className="block text-xs text-slate-400">Program mechanism<select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white"><option value="docs-bounty">Documentation bounty</option><option value="security-fund">Security response fund</option><option value="quadratic-funding">Quadratic funding</option><option value="citation-toll">Citation toll</option><option value="user-centric-royalties">User-centric royalties</option><option value="video-royalties">Video royalties</option></select></label><label className="block text-xs text-slate-400">Funding target, not confirmed funding<input type="number" min="1" step="1" value={budgetUsd} onChange={(event) => setBudgetUsd(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label></div> : null}{target.step === "policy" ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Allocation rule<select value={allocationRule} onChange={(event) => setAllocationRule(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white"><option value="verified_activity">Verified activity</option><option value="equal_recipients">Equal recipients</option><option value="hybrid">Hybrid</option></select></label><label className="text-xs text-slate-400">Eligibility<select value={eligibilityMode} onChange={(event) => setEligibilityMode(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white"><option value="resolved_only">Resolved identities only</option><option value="manual_review">Manual review</option></select></label></div> : null}{target.step === "treasury" ? <label className="block text-xs text-slate-400">Arc treasury address<input value={treasuryAddress} onChange={(event) => setTreasuryAddress(event.target.value.trim())} placeholder="0x..." className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white" /></label> : null}{target.step === "publication" ? <p className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-sm leading-6 text-amber-100">Publishing makes this operator-created program eligible for public Discover projection after its policy and treasury are also ready. This does not fund it.</p> : null}{target.step === "review" ? <p className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-sm leading-6 text-cyan-100">Review refreshes the persisted program state. It never activates a program or moves money.</p> : null}{message ? <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-2 text-sm text-emerald-100">{message}</p> : null}{error ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error}</p> : null}<button type="button" disabled={busy} onClick={() => void submit()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{target.step === "create" ? "Create program draft" : target.step === "publication" ? "Approve publication" : target.step === "policy" ? "Save and activate policy" : target.step === "treasury" ? "Save treasury destination" : target.step === "source" ? "Refresh GitHub evidence" : "Refresh program state"}</button></div>;
}

function AuthorizationReviewPanel({ action }: { action: DiscoverAction }) {
  const target = action.presentation.kind === "workbench" && action.presentation.target.panel === "authorization_review" ? action.presentation.target : null;
  const [packages, setPackages] = useState<CapitalAuthorizationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    void fetch("/api/capital/bootstrap", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as CapitalBootstrap & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Authorization packages could not be loaded");
        setPackages(body.authorizations.filter((row) => !target.authorizationId || row.id === target.authorizationId));
      })
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Authorization packages could not be loaded"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [target]);
  if (!target) return null;
  return <div className="mt-5 space-y-3">{loading ? <p className="flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading persisted authorization packages</p> : null}{packages?.map((row) => { const amountUsd = Number(BigInt(row.totalMicroUsdc)) / 1_000_000; const ready = row.readyPayeeCount === row.obligationCount && row.evidenceCount >= row.obligationCount; return <article key={row.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{row.label}</p><p className="mt-1 font-mono text-[10px] text-slate-500">Mission {row.missionId}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] ${ready ? "border-emerald-300/20 text-emerald-200" : "border-amber-300/20 text-amber-100"}`}>{ready ? "Preflight ready" : "Prerequisites missing"}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">Requested</dt><dd className="mt-1 text-white">${amountUsd.toFixed(2)} USDC</dd></div><div><dt className="text-slate-500">Obligations</dt><dd className="mt-1 text-white">{row.obligationCount}</dd></div><div><dt className="text-slate-500">Payout ready</dt><dd className="mt-1 text-white">{row.readyPayeeCount}/{row.obligationCount}</dd></div><div><dt className="text-slate-500">Evidence</dt><dd className="mt-1 text-white">{row.evidenceCount} records</dd></div></dl><p className="mt-3 text-xs leading-5 text-slate-400">Review is complete when every obligation has evidence and a payout-ready recipient. Opening this package does not submit a settlement.</p></article>; })}{packages && !packages.length ? <p className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-slate-400">No persisted authorization package currently needs review.</p> : null}{error ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error}</p> : null}</div>;
}

function InformationalPanel({ action, item }: { action: DiscoverAction; item?: EconomicActionItem }) {
  const target = action.presentation.kind === "workbench" ? action.presentation.target : null;
  if (!target) return null;
  if (target.panel === "evidence") return <div className="mt-5 space-y-4"><div className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><p className="text-sm leading-6 text-slate-300">{item?.happened ?? "Inspect the persisted evidence and its source before taking an economic action."}</p><dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-xs"><dt className="text-slate-500">Evidence records</dt><dd className="text-white">{target.evidenceIds.length || "Source record only"}</dd><dt className="text-slate-500">Repository</dt><dd className="text-white">{target.repository ?? item?.repository ?? "Not attached"}</dd><dt className="text-slate-500">Freshness</dt><dd className="text-white">{item?.source.stale ? "Last-known snapshot" : "Current persisted snapshot"}</dd></dl></div>{target.sourceUrl ? <a href={target.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">Open source evidence<ExternalLink className="h-3.5 w-3.5" /></a> : null}</div>;
  if (target.panel === "receipt") return <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4"><div className="flex items-center gap-2 text-emerald-200"><CheckCircle2 className="h-5 w-5" />Confirmed outcome</div><p className="mt-3 text-sm leading-6 text-slate-300">{item?.happened}</p><div className="mt-4 flex flex-wrap gap-2"><a href={target.receiptUrl} className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white">Open receipt</a>{target.explorerUrl ? <a href={target.explorerUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">Open ArcScan</a> : null}</div></div>;
  return null;
}

export function DiscoverActionWorkbench({ action, item, data, onClose }: Props) {
  const [payoutOpen, setPayoutOpen] = useState(false);
  const target = action?.presentation.kind === "workbench" ? action.presentation.target : null;
  useEffect(() => { if (target?.panel === "payout_destination") setPayoutOpen(true); }, [target]);
  const financial = target?.panel === "direct_support" || target?.panel === "pool_funding";
  const title = useMemo(() => action ? titleFor(action) : "Discover action", [action]);
  if (!action || !target) return null;
  return <><div className="fixed inset-0 z-[65] bg-black/65" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="discover-workbench-title" className={`ml-auto h-full w-full overflow-y-auto border-l border-white/10 bg-[#060d17] p-5 shadow-2xl sm:p-6 ${financial ? "max-w-[620px]" : "max-w-[560px]"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-violet-300">Discover action workbench</p><h2 id="discover-workbench-title" className="mt-1 text-xl font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">Review the real prerequisites and complete this action without losing Discover context.</p></div><button type="button" aria-label="Close Discover action" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button></div>{target.panel === "direct_support" ? <DirectSupportPanel action={action} onClose={onClose} signedIn={data.signedIn} /> : null}{target.panel === "pool_funding" ? <PoolFundingPanel action={action} signedIn={data.signedIn} /> : null}{target.panel === "source_sync" ? <SourceSyncPanel action={action} /> : null}{target.panel === "program_setup" ? <ProgramSetupPanel action={action} item={item} /> : null}{target.panel === "authorization_review" ? <AuthorizationReviewPanel action={action} /> : null}{!["direct_support", "pool_funding", "source_sync", "program_setup", "authorization_review", "payout_destination"].includes(target.panel) ? <InformationalPanel action={action} item={item} /> : null}{target.panel === "payout_destination" ? <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-slate-300"><WalletCards className="mb-3 h-5 w-5 text-violet-300" />Choose between the RESOLVE-managed wallet and connected wallet. These remain separate destinations and no wallet is selected automatically.</div> : null}{!data.signedIn && action.id !== "discover.open_evidence" ? <p className="mt-4 text-sm text-amber-100">Sign in is required for this personal action.</p> : null}</section></div><PayoutDestinationDrawer open={payoutOpen} origin="discover" onChanged={() => { setPayoutOpen(false); onClose(); }} onClose={() => { setPayoutOpen(false); onClose(); }} /></>;
}
