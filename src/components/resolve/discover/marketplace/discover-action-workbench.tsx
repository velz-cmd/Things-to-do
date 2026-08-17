"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
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
import { PayFromWalletSection } from "@/components/resolve/fund/pay-from-wallet-section";
import { useFundingWalletChoice } from "@/hooks/use-funding-wallet-choice";
import { PayoutDestinationDrawer } from "@/components/resolve/profile/payout-destination-drawer";
import { shouldOpenPayoutDestination } from "@/components/resolve/discover/marketplace/workbench-state";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type {
  CapitalAuthorizationSummary,
  CapitalBootstrap,
} from "@/lib/capital/bootstrap";
import { PoolCheckpointPanel } from "@/components/resolve/communities/pool-checkpoint-panel";

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
    case "direct_support":
      return `Support ${action.presentation.target.recipientLabel}`;
    case "work_funding":
      return `Fund ${action.presentation.target.workTitle}`;
    case "support_bundle":
      return "Support accepted work";
    case "request":
      return action.presentation.target.mode === "post"
        ? "Post an evidence-backed request"
        : "Request workspace";
    case "pool_funding":
      return `Fund ${action.presentation.target.poolName}`;
    case "payout_destination":
      return "Choose payout destination";
    case "program_setup":
      return "Complete program readiness";
    case "source_sync":
      return "Refresh GitHub evidence";
    case "authorization_review":
      return "Review funding authorization";
    case "receipt":
      return "Confirmed receipt";
    case "evidence":
      return "Proof";
    case "transaction":
      return "Track transaction";
    case "agent_service":
      return "Agent service";
    case "entity_details":
      return `View ${action.presentation.target.entityType}`;
    case "pool_distribution":
      return `Review ${action.presentation.target.poolName} distribution`;
  }
}

function WalletSummary({ source }: { source: FundingSource | null }) {
  const spendable = useSpendableUsd();
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs">
      <p className="font-medium text-white">
        Funding wallet must be chosen explicitly
      </p>
      <dl className="mt-2 grid grid-cols-[130px_1fr] gap-y-2">
        <dt className="text-slate-500">RESOLVE wallet</dt>
        <dd className="text-slate-200">
          ${spendable.appSpendableUsd.toFixed(2)} USDC
        </dd>
        <dt className="text-slate-500">Connected wallet</dt>
        <dd className="text-slate-200">
          {spendable.externalLinked || spendable.externalReady
            ? `$${spendable.externalSpendableUsd.toFixed(2)} USDC`
            : "Not linked"}
        </dd>
        <dt className="text-slate-500">Current choice</dt>
        <dd className="capitalize text-slate-200">
          {source ?? "No wallet selected"}
        </dd>
      </dl>
    </div>
  );
}

function RecipientPaymentPanel({
  action,
  onClose,
  signedIn,
}: {
  action: DiscoverAction;
  onClose: () => void;
  signedIn: boolean;
}) {
  const router = useRouter();
  const spendable = useSpendableUsd();
  const {
    externalWalletReady,
    openConnectWallet,
    sendDirectSupportWithWallet,
  } = useResolveAccess();
  const target =
    action.presentation.kind === "workbench" &&
    (action.presentation.target.panel === "direct_support" ||
      action.presentation.target.panel === "work_funding")
      ? action.presentation.target
      : null;
  const [preflight, setPreflight] = useState<DirectSupportPreflight | null>(
    null,
  );
  const [source, setSource] = useState<FundingSource | null>(null);
  const [amount, setAmount] = useState("5");
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState("Checking verified recipient");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<DirectSupportReceipt | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submittedTxHash, setSubmittedTxHash] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    setPreflight(null);
    setError(null);
    setIdempotencyKey(crypto.randomUUID());
    setSubmittedTxHash(null);
    setReviewed(false);
    void fetch(
      `/api/wallet/send?recipientUserId=${encodeURIComponent(target.recipientUserId)}`,
      {
        credentials: "include",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const body = (await response
          .json()
          .catch(() => ({}))) as DirectSupportPreflight & { error?: string };
        if (!response.ok)
          throw new Error(body.error ?? "Recipient verification failed");
        setPreflight(body);
        setStage("Ready for wallet selection");
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Recipient verification failed",
        );
      });
    return () => controller.abort();
  }, [target]);

  if (!target) return null;
  const isWorkReward = target.panel === "work_funding";
  const amountUsd = Number(amount);
  const chosenBalance =
    source === "app"
      ? spendable.appSpendableUsd
      : source === "external"
        ? spendable.externalSpendableUsd
        : 0;
  const canReview = Boolean(
    signedIn &&
    preflight &&
    source &&
    Number.isFinite(amountUsd) &&
    amountUsd >= 0.01 &&
    (submittedTxHash || chosenBalance >= amountUsd) &&
    !pending,
  );
  const canConfirm = Boolean(canReview && reviewed);

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
        if (!isAddress(preflight.destinationAddress))
          throw new Error("The verified payout address is invalid.");
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
          purpose: isWorkReward ? "work_reward" : "direct_support",
          workSubjectId: isWorkReward ? target.subjectId : undefined,
        }),
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as Partial<DirectSupportReceipt> & {
        error?: string;
        retryable?: boolean;
      };
      if (response.status === 202 && !body.receiptId) {
        if (body.txHash) {
          operationTxHash = body.txHash;
          setSubmittedTxHash(body.txHash);
        }
        throw new Error(
          body.error ?? "The transfer is awaiting safe receipt reconciliation.",
        );
      }
      if (!response.ok)
        throw new Error(
          body.error ??
            `${isWorkReward ? "Work funding" : "Direct support"} did not complete`,
        );
      if (
        !body.receiptId ||
        !body.receiptReference ||
        !body.receiptUrl ||
        !body.explorerUrl ||
        !body.txHash ||
        typeof body.amountUsd !== "number" ||
        !body.destinationAddress
      ) {
        throw new Error(
          "The confirmed support response did not include a complete receipt.",
        );
      }
      setReceipt(body as DirectSupportReceipt);
      setStage("Confirmed on Arc and recorded by RESOLVE");
      await spendable.refresh().catch(() => null);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `${isWorkReward ? "Work funding" : "Direct support"} did not complete`,
      );
      if (!operationTxHash) setIdempotencyKey(crypto.randomUUID());
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
        <div className="flex items-center gap-2 text-emerald-200">
          <CheckCircle2 className="h-5 w-5" />
          <strong>
            {isWorkReward ? "Work funding confirmed" : "Support confirmed"}
          </strong>
        </div>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-xs">
          <dt className="text-slate-500">Amount</dt>
          <dd className="text-white">${receipt.amountUsd.toFixed(2)} USDC</dd>
          <dt className="text-slate-500">Recipient</dt>
          <dd className="text-white">{target.recipientLabel}</dd>
          <dt className="text-slate-500">Receipt</dt>
          <dd className="break-all text-white">{receipt.receiptReference}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={receipt.receiptUrl}
            className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white"
          >
            Open receipt
          </a>
          <a
            href={receipt.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200"
          >
            ArcScan
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-xs">
        <div className="flex items-center gap-2 text-cyan-200">
          <ShieldCheck className="h-4 w-4" />
          Verified recipient preflight
        </div>
        {preflight ? (
          <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2">
            <dt className="text-slate-500">Recipient</dt>
            <dd className="text-white">{preflight.recipientLabel}</dd>
            <dt className="text-slate-500">Destination</dt>
            <dd className="break-all font-mono text-white">
              {preflight.destinationAddress}
            </dd>
            <dt className="text-slate-500">Network</dt>
            <dd className="text-white">
              {preflight.network} {preflight.asset}
            </dd>
          </dl>
        ) : (
          <p className="mt-3 text-slate-400">{stage}</p>
        )}
      </div>
      {isWorkReward ? (
        <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-xs">
          <p className="font-medium text-cyan-100">Persisted work evidence</p>
          <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2">
            <dt className="text-slate-500">Work</dt>
            <dd className="text-white">{target.workTitle}</dd>
            <dt className="text-slate-500">Repository</dt>
            <dd className="text-white">{target.repository}</dd>
            <dt className="text-slate-500">Meaning</dt>
            <dd className="text-slate-300">
              Voluntary reward. This does not create or settle a policy
              obligation.
            </dd>
          </dl>
          <a
            href={target.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-cyan-200"
          >
            Open source proof
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : null}
      <label className="block text-xs text-slate-400">
        Amount in USDC
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setReviewed(false);
          }}
          disabled={pending || Boolean(submittedTxHash) || reviewed}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
        />
      </label>
      <WalletSummary source={source} />
      <WalletSourcePicker
        appUsd={spendable.appSpendableUsd}
        extUsd={spendable.externalSpendableUsd}
        amountUsd={amountUsd}
        externalReady={externalWalletReady}
        hasLinkedExternal={spendable.externalLinked}
        value={source}
        onChange={(next) => {
          setSource(next);
          setReviewed(false);
        }}
        disabled={pending || Boolean(submittedTxHash) || reviewed}
        onReconnectExternal={openConnectWallet}
      />
      {!spendable.externalLinked && !externalWalletReady ? (
        <button
          type="button"
          onClick={() => {
            setSource("app");
            setReviewed(false);
          }}
          aria-pressed={source === "app"}
          className={`w-full rounded-lg border p-3 text-left text-xs ${source === "app" ? "border-violet-300/50 bg-violet-400/10 text-white" : "border-white/10 text-slate-300"}`}
        >
          <strong>RESOLVE wallet</strong>
          <span className="mt-1 block">
            ${spendable.appSpendableUsd.toFixed(2)} USDC on Arc
          </span>
        </button>
      ) : null}
      {reviewed && preflight && source ? (
        <div className="rounded-xl border border-violet-300/20 bg-violet-300/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Review transfer</p>
            <button
              type="button"
              onClick={() => setReviewed(false)}
              className="text-xs text-violet-200"
            >
              Modify
            </button>
          </div>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">From</dt>
              <dd className="mt-1 capitalize text-white">
                {source === "app" ? "RESOLVE wallet" : "Connected wallet"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">To</dt>
              <dd className="mt-1 text-white">{preflight.recipientLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Amount</dt>
              <dd className="mt-1 text-white">${amountUsd.toFixed(2)} USDC</dd>
            </div>
            <div>
              <dt className="text-slate-500">Network</dt>
              <dd className="mt-1 text-white">Arc Testnet</dd>
            </div>
            <div>
              <dt className="text-slate-500">Network fee</dt>
              <dd className="mt-1 text-white">
                Shown by the selected wallet before authorization
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Mechanism</dt>
              <dd className="mt-1 text-white">
                {isWorkReward
                  ? "Voluntary accepted-work reward"
                  : "Direct contributor support"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-amber-100">
            Authorization is a separate step. A connected wallet will request a
            human signature. RESOLVE issues a receipt only after Arc confirms
            the transaction.
          </p>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}
      {pending ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-violet-200"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {stage}
        </p>
      ) : null}
      <button
        type="button"
        disabled={
          submittedTxHash ? !canConfirm : reviewed ? !canConfirm : !canReview
        }
        onClick={() => {
          if (!reviewed && !submittedTxHash) setReviewed(true);
          else void confirm();
        }}
        className="w-full rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submittedTxHash
          ? "Retry receipt recording"
          : reviewed
            ? `Authorise and submit $${Number.isFinite(amountUsd) ? amountUsd.toFixed(2) : "0.00"} USDC`
            : "Review transfer"}
      </button>
    </div>
  );
}

function SupportBundlePanel({ action }: { action: DiscoverAction }) {
  const router = useRouter();
  const spendable = useSpendableUsd();
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "support_bundle"
      ? action.presentation.target
      : null;
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ subjectId: string; receiptUrl: string; txHash: string }>>([]);
  const keys = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!target) return;
    setAmounts(
      Object.fromEntries(target.workItems.map((item) => [item.subjectId, "5"])),
    );
    keys.current = Object.fromEntries(
      target.workItems.map((item) => [item.subjectId, crypto.randomUUID()]),
    );
    setReviewed(false);
    setResults([]);
    setError(null);
  }, [target]);

  if (!target) return null;
  const currentTarget = target;
  const total = target.workItems.reduce(
    (sum, item) => sum + (Number(amounts[item.subjectId]) || 0),
    0,
  );
  const valid =
    target.workItems.length > 0 &&
    target.workItems.every((item) => Number(amounts[item.subjectId]) >= 0.01) &&
    total <= spendable.appSpendableUsd;

  async function submit() {
    if (!reviewed || !valid) return;
    setBusy(true);
    setError(null);
    const completed = [...results];
    try {
      for (const item of currentTarget.workItems) {
        if (completed.some((result) => result.subjectId === item.subjectId)) continue;
        setStage(`Confirming ${item.workTitle}`);
        const response = await fetch("/api/wallet/send", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            recipientUserId: item.recipientUserId,
            amountUsd: Number(amounts[item.subjectId]),
            idempotencyKey: keys.current[item.subjectId],
            fundingSource: "app",
            purpose: "work_reward",
            workSubjectId: item.subjectId,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          receiptUrl?: string;
          txHash?: string;
        };
        if (!response.ok || !body.receiptUrl || !body.txHash) {
          throw new Error(
            body.error ?? `The reward for ${item.workTitle} did not confirm`,
          );
        }
        completed.push({
          subjectId: item.subjectId,
          receiptUrl: body.receiptUrl,
          txHash: body.txHash,
        });
        setResults([...completed]);
      }
      setStage("Every reward is confirmed and receipt-backed");
      await spendable.refresh().catch(() => null);
      router.refresh();
    } catch (reason) {
      setError(
        `${reason instanceof Error ? reason.message : "Support bundle stopped"} Completed rewards are preserved and will not be sent again when you retry.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <p className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-sm leading-6 text-cyan-100">
        Each selected item is revalidated against current persisted Evidence, attribution, and payout state. Every recipient receives a separate Arc transfer and receipt. Completed transfers survive a partial retry.
      </p>
      <div className="space-y-3">
        {target.workItems.map((item) => {
          const complete = results.find((result) => result.subjectId === item.subjectId);
          return (
            <article key={item.subjectId} className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-sm font-semibold text-white">{item.workTitle}</h3><p className="mt-1 text-xs text-slate-400">{item.recipientLabel} / {item.repository}</p></div>
                {complete ? <span className="text-xs text-emerald-200">Confirmed</span> : null}
              </div>
              <label className="mt-3 block text-xs text-slate-400">Reward, USDC<input type="number" min="0.01" step="0.01" value={amounts[item.subjectId] ?? "5"} disabled={reviewed || busy || Boolean(complete)} onChange={(event) => setAmounts((current) => ({ ...current, [item.subjectId]: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" /></label>
              {complete ? <a href={complete.receiptUrl} className="mt-3 inline-flex text-xs font-medium text-emerald-200">Open receipt</a> : <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-200">Inspect source <ExternalLink className="h-3 w-3" /></a>}
            </article>
          );
        })}
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-xs">
        <div className="flex justify-between gap-3"><span className="text-slate-400">Total</span><strong className="text-white">${total.toFixed(2)} USDC</strong></div>
        <div className="mt-2 flex justify-between gap-3"><span className="text-slate-400">From</span><span className="text-white">RESOLVE Circle wallet on Arc Testnet</span></div>
        <div className="mt-2 flex justify-between gap-3"><span className="text-slate-400">Available</span><span className="text-white">${spendable.appSpendableUsd.toFixed(2)} USDC</span></div>
      </div>
      {reviewed ? <p className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-xs leading-5 text-amber-100">Authorizing starts real transfers. A result appears only after each transaction is confirmed on Arc and its RESOLVE receipt is stored.</p> : null}
      {stage ? <p aria-live="polite" className="text-sm text-violet-200">{stage}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      <button type="button" disabled={!valid || busy || results.length === target.workItems.length} onClick={() => reviewed ? void submit() : setReviewed(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{results.length === target.workItems.length ? "All rewards confirmed" : reviewed ? `Authorise ${target.workItems.length - results.length} Arc transfer${target.workItems.length - results.length === 1 ? "" : "s"}` : "Review support bundle"}</button>
    </div>
  );
}

function PoolFundingPanel({
  action,
  signedIn,
}: {
  action: DiscoverAction;
  signedIn: boolean;
}) {
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "pool_funding"
      ? action.presentation.target
      : null;
  const {
    executeFund,
    fundProgress,
    resetFundProgress,
    externalWalletReady,
    spendable,
  } = useFundProgramExecution(target?.communitySlug);
  const { openConnectWallet } = useResolveAccess();
  const [source, setSource] = useState<FundingSource | null>(null);
  const [amount, setAmount] = useState("5");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [preflight, setPreflight] = useState<{
    ready: boolean;
    blocker: string | null;
    publicationState: string;
    policyState: string;
    allocationState: string;
    treasuryState: string;
    treasuryAddress: string | null;
    network: string;
    asset: string;
  } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightAttempt, setPreflightAttempt] = useState(0);
  useEffect(() => {
    resetFundProgress();
    setSource(null);
    setError(null);
    setReviewed(false);
  }, [resetFundProgress, target?.subjectId]);
  useEffect(() => {
    if (!target?.programId || !signedIn) return;
    const controller = new AbortController();
    setPreflightLoading(true);
    setPreflight(null);
    fetch(
      `/api/capital/fund?programId=${encodeURIComponent(target.programId)}`,
      {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          preflight?: NonNullable<typeof preflight>;
        };
        if (!body.preflight) {
          throw new Error(body.error ?? "Pool preflight could not be loaded");
        }
        setPreflight(body.preflight);
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Pool preflight could not be loaded",
          );
        }
      })
      .finally(() => setPreflightLoading(false));
    return () => controller.abort();
  }, [preflightAttempt, signedIn, target?.programId]);
  if (!target) return null;
  const currentTarget = target;
  const amountUsd = Number(amount);
  const selectedBalance =
    source === "app"
      ? spendable.appSpendableUsd
      : source === "external"
        ? spendable.externalSpendableUsd
        : 0;
  const canReview = Boolean(
    signedIn &&
    source &&
    amountUsd >= 5 &&
    selectedBalance >= amountUsd &&
    !pending &&
    target.programId &&
    preflight?.ready &&
    !preflightLoading,
  );
  const canFund = Boolean(canReview && reviewed);
  async function confirm() {
    if (!canFund || !source) return;
    setPending(true);
    setError(null);
    try {
      await executeFund(
        {
          programId: currentTarget.programId,
          communitySlug: currentTarget.communitySlug,
          label: currentTarget.poolName,
          amountUsd,
        },
        source,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Pool funding did not complete",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-xs">
        <dl className="grid grid-cols-[120px_1fr] gap-y-2">
          <dt className="text-slate-500">Pool</dt>
          <dd className="text-white">{target.poolName}</dd>
          <dt className="text-slate-500">Community</dt>
          <dd className="text-white">{target.communitySlug}</dd>
          <dt className="text-slate-500">Network</dt>
          <dd className="text-white">Arc Testnet USDC</dd>
          <dt className="text-slate-500">Program</dt>
          <dd className="break-all text-white">{target.programId}</dd>
        </dl>
      </div>
      {preflightLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Checking publication, policy, allocation and treasury
        </p>
      ) : preflight ? (
        <div
          className={`rounded-xl border p-4 text-xs ${preflight.ready ? "border-emerald-300/20 bg-emerald-300/[0.04]" : "border-amber-300/20 bg-amber-300/[0.04]"}`}
        >
          <p className="font-semibold text-white">
            {preflight.ready
              ? "Pool preflight passed"
              : "Pool funding is blocked"}
          </p>
          {preflight.blocker ? (
            <p className="mt-2 leading-5 text-amber-100">{preflight.blocker}</p>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-slate-300">
              <div>
                <dt className="text-slate-500">Publication</dt>
                <dd className="mt-1">{preflight.publicationState}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Policy</dt>
                <dd className="mt-1">{preflight.policyState}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Allocation</dt>
                <dd className="mt-1">{preflight.allocationState}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Treasury</dt>
                <dd className="mt-1">{preflight.treasuryState}</dd>
              </div>
            </dl>
          )}
          {!preflight.ready ? (
            <button
              type="button"
              onClick={() => setPreflightAttempt((attempt) => attempt + 1)}
              className="mt-3 text-sm font-medium text-violet-200"
            >
              Retry preflight
            </button>
          ) : null}
        </div>
      ) : null}
      <label className="block text-xs text-slate-400">
        Amount in USDC
        <input
          type="number"
          min="5"
          step="0.01"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setReviewed(false);
          }}
          disabled={pending || reviewed}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
        />
      </label>
      <WalletSummary source={source} />
      <WalletSourcePicker
        appUsd={spendable.appSpendableUsd}
        extUsd={spendable.externalSpendableUsd}
        amountUsd={amountUsd}
        externalReady={externalWalletReady}
        hasLinkedExternal={spendable.externalLinked}
        value={source}
        onChange={(next) => {
          setSource(next);
          setReviewed(false);
        }}
        disabled={pending || reviewed}
        onReconnectExternal={openConnectWallet}
      />
      {!spendable.externalLinked && !externalWalletReady ? (
        <button
          type="button"
          onClick={() => {
            setSource("app");
            setReviewed(false);
          }}
          aria-pressed={source === "app"}
          className={`w-full rounded-lg border p-3 text-left text-xs ${source === "app" ? "border-violet-300/50 bg-violet-400/10 text-white" : "border-white/10 text-slate-300"}`}
        >
          <strong>RESOLVE wallet</strong>
          <span className="mt-1 block">
            ${spendable.appSpendableUsd.toFixed(2)} USDC on Arc
          </span>
        </button>
      ) : null}
      {reviewed && source ? (
        <div className="rounded-xl border border-violet-300/20 bg-violet-300/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              Review Pool funding
            </p>
            <button
              type="button"
              onClick={() => setReviewed(false)}
              className="text-xs text-violet-200"
            >
              Modify
            </button>
          </div>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">From</dt>
              <dd className="mt-1 text-white">
                {source === "app" ? "RESOLVE wallet" : "Connected wallet"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Pool</dt>
              <dd className="mt-1 text-white">{target.poolName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Pool type</dt>
              <dd className="mt-1 text-white">
                {target.poolType ?? "Community Pool"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Amount</dt>
              <dd className="mt-1 text-white">${amountUsd.toFixed(2)} USDC</dd>
            </div>
            <div>
              <dt className="text-slate-500">Network</dt>
              <dd className="mt-1 text-white">Arc Testnet</dd>
            </div>
            <div>
              <dt className="text-slate-500">Network fee</dt>
              <dd className="mt-1 text-white">
                Shown by the selected wallet before authorization
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Mechanism</dt>
              <dd className="mt-1 text-white">Community Pool funding</dd>
            </div>
            <div>
              <dt className="text-slate-500">Active rule</dt>
              <dd className="mt-1 text-white">
                {target.activeRule ?? "Persisted Pool allocation policy"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Treasury</dt>
              <dd className="mt-1 break-all font-mono text-white">
                {preflight?.treasuryAddress ?? "Unavailable"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-amber-100">
            Authorizing may request a human wallet signature. Submitted funding
            remains pending until Arc confirmation and receipt issuance.
          </p>
        </div>
      ) : null}
      <FundProgressPanel
        stage={fundProgress.stage}
        fundingSource={fundProgress.fundingSource ?? source ?? "app"}
        amountUsd={fundProgress.amountUsd ?? amountUsd}
        txHash={fundProgress.txHash}
      />
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={
          reviewed ? !canFund || fundProgress.stage === "complete" : !canReview
        }
        onClick={() => {
          if (!reviewed) setReviewed(true);
          else void confirm();
        }}
        className="w-full rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {fundProgress.stage === "complete"
          ? "Funding confirmed"
          : reviewed
            ? `Authorise and submit $${Number.isFinite(amountUsd) ? amountUsd.toFixed(2) : "0.00"} USDC`
            : "Review Pool funding"}
      </button>
    </div>
  );
}

type RequestDetail = {
  opportunity: {
    id: string;
    title: string;
    description: string;
    status: string;
    creatorName: string;
    repository: string | null;
    rewardAmountUsd: number | null;
    rewardToken: string | null;
    evidenceRequirements: unknown;
    deliverables: unknown;
    deadline: string | null;
    fundingStatus: string | null;
    selectedProviderName: string | null;
  };
  viewer: { owner: boolean; selected: boolean };
  activity: Array<{
    id: string;
    eventType: string;
    summary: string;
    occurredAt: string;
  }>;
  settlement: { status: string; error: string | null } | null;
};

/** Lifecycle steps in customer language - never a raw event name. */
const REQUEST_LIFECYCLE_LABELS: Record<string, string> = {
  request_created: "Request created",
  request_funded: "Budget locked in Arc escrow",
  request_published: "Published to contributors",
  request_taken: "Contributor took the request",
  request_assigned: "Contributor assigned",
  work_submitted: "Work submitted",
  request_under_review: "Awaiting requester review",
  request_approved: "Requester approved the work",
  payment_released: "Payment released",
  request_payment_confirmed: "Payment confirmed on Arc",
  request_cancelled: "Request cancelled",
  request_refunded: "Budget refunded",
};

function requestLifecycleLabel(eventType: string): string {
  const mapped = REQUEST_LIFECYCLE_LABELS[eventType];
  if (mapped) return mapped;
  const words = eventType.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function RequestPanel({ action, onClose }: { action: DiscoverAction; onClose: () => void }) {
  const router = useRouter();
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "request"
      ? action.presentation.target
      : null;
  const [requestId, setRequestId] = useState(
    target?.mode === "view" ? target.subjectId : null,
  );
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(requestId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repository, setRepository] = useState("");
  const [budget, setBudget] = useState("25");
  const [evidenceRequirement, setEvidenceRequirement] = useState(
    "A persisted Evidence record linked to the completed work",
  );
  const [acceptanceRequirement, setAcceptanceRequirement] = useState(
    "The requested result is complete and the requester can inspect its evidence",
  );
  const [proposal, setProposal] = useState("");
  const [evidenceIds, setEvidenceIds] = useState("");
  const [note, setNote] = useState("");
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  useEffect(() => {
    if (!requestId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetch(
      `/api/discover/requests?opportunityId=${encodeURIComponent(requestId)}`,
      { credentials: "include", cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as RequestDetail & {
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "Request could not be loaded");
        setDetail(body);
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof Error ? reason.message : "Request could not be loaded");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reload, requestId]);

  if (!target) return null;

  async function command(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/discover/requests", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey: crypto.randomUUID() }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        blockers?: string[];
        opportunityId?: string;
        status?: string;
        receiptUrl?: string;
      };
      if (!response.ok) {
        const blockers = body.blockers?.length ? ` ${body.blockers.join(" ")}` : "";
        throw new Error(`${body.error ?? "Request action failed"}${blockers}`);
      }
      if (body.opportunityId) setRequestId(body.opportunityId);
      setMessage(
        body.receiptUrl
          ? `Payment confirmed. Receipt: ${body.receiptUrl}`
          : `Request updated to ${body.status?.replaceAll("_", " ") ?? "the next state"}.`,
      );
      setReload((value) => value + 1);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!requestId) {
    const amount = Number(budget);
    const valid =
      title.trim().length >= 5 &&
      description.trim().length >= 30 &&
      evidenceRequirement.trim().length >= 8 &&
      acceptanceRequirement.trim().length >= 8 &&
      Number.isFinite(amount) &&
      amount >= 0.01;
    return (
      <div className="mt-5 space-y-4">
        <p className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-sm leading-6 text-cyan-100">
          Define the result, its acceptance proof, and the budget. RESOLVE saves a private draft first. It becomes public only after Arc escrow confirms the budget.
        </p>
        <label className="block text-xs text-slate-400">Request title<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
        <label className="block text-xs text-slate-400">What must be completed<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">Repository, optional<input value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
          <label className="block text-xs text-slate-400">Budget, USDC<input type="number" min="0.01" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
        </div>
        <label className="block text-xs text-slate-400">Required evidence<textarea value={evidenceRequirement} onChange={(event) => setEvidenceRequirement(event.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
        <label className="block text-xs text-slate-400">Acceptance condition<textarea value={acceptanceRequirement} onChange={(event) => setAcceptanceRequirement(event.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label>
        {error ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error}</p> : null}
        <button type="button" disabled={!valid || busy} onClick={() => void command({ action: "create", title, description, repository: repository.trim() || undefined, requestType: "task", evidenceRequirement, acceptanceRequirement, budgetUsd: amount })} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Create private request draft</button>
      </div>
    );
  }

  if (loading && !detail) return <p className="mt-5 flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading canonical request</p>;
  if (!detail) return <div className="mt-5"><p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error ?? "Request is unavailable"}</p><button type="button" onClick={() => setReload((value) => value + 1)} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-white">Retry</button></div>;
  const request = detail.opportunity;
  const evidenceList = Array.isArray(request.evidenceRequirements) ? request.evidenceRequirements.join(", ") : "Persisted Evidence required";
  const deliverables = Array.isArray(request.deliverables) ? request.deliverables.join(", ") : "Requester acceptance required";
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-cyan-300">{request.repository ?? "Independent request"}</p><h3 className="mt-1 font-semibold text-white">{request.title}</h3></div><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] capitalize text-slate-300">{request.status.replaceAll("_", " ")}</span></div>
        <p className="mt-3 text-sm leading-6 text-slate-300">{request.description}</p>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">Requester</dt><dd className="mt-1 text-white">{request.creatorName}</dd></div><div><dt className="text-slate-500">Budget</dt><dd className="mt-1 text-white">${(request.rewardAmountUsd ?? 0).toFixed(2)} {request.rewardToken ?? "USDC"}</dd></div><div><dt className="text-slate-500">Evidence</dt><dd className="mt-1 text-white">{evidenceList}</dd></div><div><dt className="text-slate-500">Acceptance</dt><dd className="mt-1 text-white">{deliverables}</dd></div></dl>
      </div>
      {!detail.viewer.owner && !detail.viewer.selected && request.status === "open" ? <label className="block text-xs text-slate-400">How you will complete it<textarea value={proposal} onChange={(event) => setProposal(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label> : null}
      {detail.viewer.selected && request.status === "assigned" ? <><label className="block text-xs text-slate-400">Persisted Evidence IDs<input value={evidenceIds} onChange={(event) => setEvidenceIds(event.target.value)} placeholder="evidence_id_1, evidence_id_2" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label><label className="block text-xs text-slate-400">Submission note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label></> : null}
      {detail.viewer.owner && request.status === "under_review" ? <label className="block text-xs text-slate-400">Approval note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label> : null}
      {showCancellation ? <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4"><p className="text-sm font-medium text-amber-100">{request.fundingStatus === "escrowed" ? "Review escrow refund" : "Review request cancellation"}</p><p className="mt-1 text-xs leading-5 text-slate-400">{request.fundingStatus === "escrowed" ? "RESOLVE will request the canonical escrow refund. The request closes only after the adapter confirms the refund." : "This private or unfunded request will close without moving funds."}</p><label className="mt-3 block text-xs text-slate-400">Reason<textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || cancellationReason.trim().length < 3} onClick={() => void command({ action: "refund", opportunityId: request.id, reason: cancellationReason })} className="rounded-lg bg-rose-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{request.fundingStatus === "escrowed" ? "Authorise refund" : "Confirm cancellation"}</button><button type="button" disabled={busy} onClick={() => { setShowCancellation(false); setCancellationReason(""); }} className="rounded-lg border border-white/10 px-4 py-3 text-sm text-slate-300 disabled:opacity-50">Keep request open</button></div></div> : null}
      {message ? <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-2 text-sm text-emerald-100">{message}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {detail.viewer.owner && request.status === "ready_to_fund" ? <button type="button" disabled={busy} onClick={() => void command({ action: "fund_publish", opportunityId: request.id })} className="rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Fund escrow and publish</button> : null}
        {!detail.viewer.owner && !detail.viewer.selected && request.status === "open" ? <button type="button" disabled={busy || proposal.trim().length < 20} onClick={() => void command({ action: "take", opportunityId: request.id, proposal })} className="rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Take request</button> : null}
        {detail.viewer.selected && request.status === "assigned" ? <button type="button" disabled={busy || note.trim().length < 10 || !evidenceIds.trim()} onClick={() => void command({ action: "submit_work", opportunityId: request.id, evidenceIds: evidenceIds.split(",").map((id) => id.trim()).filter(Boolean), note })} className="rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Submit evidence</button> : null}
        {detail.viewer.owner && request.status === "under_review" ? <button type="button" disabled={busy || note.trim().length < 3} onClick={() => void command({ action: "approve", opportunityId: request.id, note })} className="rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Approve submitted work</button> : null}
        {detail.viewer.owner && request.status === "approved" ? <button type="button" disabled={busy} onClick={() => void command({ action: "release", opportunityId: request.id })} className="rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Release payment</button> : null}
        {detail.viewer.owner && ["ready_to_fund", "open", "assigned"].includes(request.status) && !showCancellation ? <button type="button" disabled={busy} onClick={() => setShowCancellation(true)} className="rounded-lg border border-rose-300/20 px-4 py-3 text-sm text-rose-100 disabled:opacity-50">{request.fundingStatus === "escrowed" ? "Cancel and refund" : "Cancel request"}</button> : null}
        {/* "Refresh state" was a customer-facing button whose only effect was
            re-reading the record. Every stage above already offers the real
            action, so it only added noise next to them. */}
        <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-3 text-sm text-slate-300">Close</button>
      </div>
      {detail.activity.length ? <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><p className="text-xs font-semibold text-slate-300">Lifecycle</p><ol className="mt-3 space-y-3">{detail.activity.slice(0, 8).map((row) => <li key={row.id} className="text-xs"><p className="font-medium text-white">{requestLifecycleLabel(row.eventType)}</p><p className="mt-1 text-slate-400">{row.summary}</p></li>)}</ol></div> : null}
    </div>
  );
}

function SourceSyncPanel({ action }: { action: DiscoverAction }) {
  const router = useRouter();
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "source_sync"
      ? action.presentation.target
      : null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!target) return null;
  async function sync() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const repositoryRefresh = Boolean(target!.repository);
      const response = await fetch(
        repositoryRefresh
          ? "/api/discover/oss-snapshots"
          : "/api/profile/connections",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify(
            repositoryRefresh
              ? { repository: target!.repository }
              : { provider: target!.provider },
          ),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        ingested?: number;
      };
      if (!response.ok)
        throw new Error(body.error ?? "Source refresh was not accepted");
      setMessage(
        repositoryRefresh
          ? "Repository evidence was refreshed and persisted."
          : `GitHub connection refresh completed${typeof body.ingested === "number" ? `, ${body.ingested} records ingested` : ""}.`,
      );
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Source refresh failed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-slate-300">
        <p>
          Refresh the persisted GitHub connection and evidence state. Existing
          records remain visible if the provider fails.
        </p>
        {target.repository ? (
          <p className="mt-2 font-mono text-xs text-white">
            {target.repository}
          </p>
        ) : null}
      </div>
      {message ? (
        <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void sync()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Refresh GitHub state
      </button>
    </div>
  );
}

function ProgramSetupPanel({
  action,
  item,
}: {
  action: DiscoverAction;
  item?: EconomicActionItem;
}) {
  const router = useRouter();
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "program_setup"
      ? action.presentation.target
      : null;
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
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (target!.step === "review") {
        setMessage(
          "The current persisted program state was reviewed. No lifecycle change was submitted.",
        );
        router.refresh();
        return;
      }
      let response: Response;
      if (target!.step === "create") {
        const budget = Number(budgetUsd);
        if (!name.trim() || !Number.isFinite(budget) || budget <= 0)
          throw new Error("Enter a program name and positive budget target.");
        response = await fetch(
          `/api/communities/${encodeURIComponent(target!.communitySlug)}/programs`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type": "application/json",
              "idempotency-key": crypto.randomUUID(),
            },
            body: JSON.stringify({
              name: name.trim(),
              templateId,
              budgetUsd: budget,
            }),
          },
        );
      } else if (target!.step === "source") {
        response = await fetch("/api/profile/connections", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({ provider: "github" }),
        });
      } else {
        if (!target!.programId)
          throw new Error(
            "No persisted program is available for this setup step.",
          );
        const body =
          target!.step === "publication"
            ? { setup: { publicationStatus: "approved" } }
            : target!.step === "policy"
              ? {
                  rules: { allocationRule, eligibilityMode },
                  setup: { policyStatus: "active" },
                }
              : target!.step === "treasury"
                ? isAddress(treasuryAddress)
                  ? { setup: { treasuryAddress } }
                  : (() => {
                      throw new Error("Enter a valid Arc treasury address.");
                    })()
                : {};
        response = await fetch(
          `/api/communities/${encodeURIComponent(target!.communitySlug)}/programs/${encodeURIComponent(target!.programId)}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: {
              "content-type": "application/json",
              "idempotency-key": crypto.randomUUID(),
            },
            body: JSON.stringify(body),
          },
        );
      }
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        program?: { id?: string };
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Program setup did not complete");
      setMessage(
        target!.step === "create"
          ? "Program draft created. Its next persisted prerequisite will appear after refresh."
          : `${target!.step.replaceAll("_", " ")} completed.`,
      );
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Program setup did not complete",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-xs">
          <dt className="text-slate-500">Community</dt>
          <dd className="text-white">{target.communitySlug}</dd>
          <dt className="text-slate-500">Program</dt>
          <dd className="break-all text-white">
            {target.programId ?? "No program exists yet"}
          </dd>
          <dt className="text-slate-500">Required step</dt>
          <dd className="capitalize text-white">{target.step}</dd>
        </dl>
        {item?.blocker ? (
          <p className="mt-4 text-sm leading-6 text-amber-100">
            {item.blocker}
          </p>
        ) : null}
      </div>
      {target.step === "create" ? (
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">
            Program name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Program mechanism
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white"
            >
              <option value="docs-bounty">Documentation bounty</option>
              <option value="security-fund">Security response fund</option>
              <option value="quadratic-funding">Quadratic funding</option>
              <option value="citation-toll">Citation toll</option>
              <option value="user-centric-royalties">
                User-centric royalties
              </option>
              <option value="video-royalties">Video royalties</option>
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Funding target, not confirmed funding
            <input
              type="number"
              min="1"
              step="1"
              value={budgetUsd}
              onChange={(event) => setBudgetUsd(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            />
          </label>
        </div>
      ) : null}
      {target.step === "policy" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Allocation rule
            <select
              value={allocationRule}
              onChange={(event) => setAllocationRule(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white"
            >
              <option value="verified_activity">Verified activity</option>
              <option value="equal_recipients">Equal recipients</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Eligibility
            <select
              value={eligibilityMode}
              onChange={(event) => setEligibilityMode(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white"
            >
              <option value="resolved_only">Resolved identities only</option>
              <option value="manual_review">Manual review</option>
            </select>
          </label>
        </div>
      ) : null}
      {target.step === "treasury" ? (
        <label className="block text-xs text-slate-400">
          Arc treasury address
          <input
            value={treasuryAddress}
            onChange={(event) => setTreasuryAddress(event.target.value.trim())}
            placeholder="0x..."
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white"
          />
        </label>
      ) : null}
      {target.step === "publication" ? (
        <p className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-sm leading-6 text-amber-100">
          Publishing makes this operator-created program eligible for public
          Discover projection after its policy and treasury are also ready. This
          does not fund it.
        </p>
      ) : null}
      {target.step === "review" ? (
        <p className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-sm leading-6 text-cyan-100">
          Review refreshes the persisted program state. It never activates a
          program or moves money.
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}
      {/* "review" means every prerequisite already passed. Offering a
          "Refresh program state" button here was a dead end - refreshing
          backend state is not customer work and changed nothing. Point at
          the real next action instead. */}
      {target.step === "review" ? (
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
          <p className="font-semibold text-emerald-100">Setup is complete</p>
          <p className="mt-2 text-sm leading-6 text-emerald-100/80">
            Publication, funding policy and treasury destination are all in
            place, so this Pool can receive capital. Close this panel and use
            Fund Pool, or Review distribution once it holds confirmed funding.
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {target.step === "create"
            ? "Create program draft"
            : target.step === "publication"
              ? "Approve publication"
              : target.step === "policy"
                ? "Save and activate policy"
                : target.step === "treasury"
                  ? "Save treasury destination"
                  : "Refresh GitHub evidence"}
        </button>
      )}
    </div>
  );
}

function AuthorizationReviewPanel({ action }: { action: DiscoverAction }) {
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "authorization_review"
      ? action.presentation.target
      : null;
  const [packages, setPackages] = useState<
    CapitalAuthorizationSummary[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetch("/api/capital/bootstrap", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response
          .json()
          .catch(() => ({}))) as CapitalBootstrap & { error?: string };
        if (!response.ok)
          throw new Error(
            body.error ?? "Authorization packages could not be loaded",
          );
        setPackages(
          body.authorizations.filter(
            (row) =>
              !target.authorizationId || row.id === target.authorizationId,
          ),
        );
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setError(
            reason instanceof Error
              ? reason.message
              : "Authorization packages could not be loaded",
          );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [target]);
  if (!target) return null;
  return (
    <div className="mt-5 space-y-3">
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading persisted authorization packages
        </p>
      ) : null}
      {packages?.map((row) => {
        const amountUsd = Number(BigInt(row.totalMicroUsdc)) / 1_000_000;
        const unresolvedRecipients = Math.max(
          0,
          row.obligationCount - row.readyPayeeCount,
        );
        const ready = unresolvedRecipients === 0 && row.evidenceCount >= row.obligationCount;
        return (
          <article
            key={row.id}
            className="rounded-xl border border-white/[0.08] bg-black/20 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{row.label}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  Mission {row.missionId}
                </p>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-[10px] ${ready ? "border-emerald-300/20 text-emerald-200" : "border-amber-300/20 text-amber-100"}`}
              >
                {ready ? "Preflight ready" : "Prerequisites missing"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500">Requested</dt>
                <dd className="mt-1 text-white">
                  ${amountUsd.toFixed(2)} USDC
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Obligations</dt>
                <dd className="mt-1 text-white">{row.obligationCount}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Payout ready</dt>
                <dd className="mt-1 text-white">
                  {row.readyPayeeCount}/{row.obligationCount}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Evidence</dt>
                <dd className="mt-1 text-white">{row.evidenceCount} records</dd>
              </div>
            </dl>
            {ready ? (
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Every obligation in this package has evidence and a
                payout-ready recipient. Submit settlement from the community
                Obligations desk to preflight and authorize the real payout.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-5 text-amber-100/80">
                Recipients needing a payout destination: {unresolvedRecipients}
                {row.evidenceCount < row.obligationCount
                  ? ` · ${row.obligationCount - row.evidenceCount} obligation${row.obligationCount - row.evidenceCount === 1 ? "" : "s"} missing evidence`
                  : null}
                . {unresolvedRecipients > 0
                  ? "Only the recipient can add their own verified payout destination — RESOLVE cannot assign one on their behalf."
                  : "Missing evidence must be resolved at the source before this package can settle."}
              </p>
            )}
            {row.communitySlug ? (
              <a
                href={`/communities/${encodeURIComponent(row.communitySlug)}#obligations`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-200 hover:text-cyan-100"
              >
                {ready ? "Open Obligations desk to submit settlement" : "Review recipients in the Obligations desk"}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                This package is not linked to an installed community, so
                RESOLVE cannot route you to a recipient-resolution desk for
                it.
              </p>
            )}
          </article>
        );
      })}
      {packages && !packages.length ? (
        <p className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-slate-400">
          No persisted authorization package currently needs review.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Reuses the real, already-built checkpoint/settlement engine
 * (PoolCheckpointPanel + useProgramPoolState) that community operators
 * already use to review and pay Pool distributions. This is the same
 * component, same data hook, same /api/communities/[slug]/programs/
 * [programId]/checkpoint-settle mutation - not a rebuild, not a fake
 * summary. It surfaces eligible recipients, per-recipient owed amounts,
 * the batch total, checkpoint state, and settlement history, and the
 * "Pay $X to Y at checkpoint" action only enables once a checkpoint is
 * actually reached and the Pool balance covers what's owed.
 */
function PoolDistributionPanel({ action }: { action: DiscoverAction }) {
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "pool_distribution"
      ? action.presentation.target
      : null;
  if (!target) return null;
  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <p className="text-xs font-medium text-cyan-300">{target.poolName}</p>
        <h3 className="mt-1 font-semibold text-white">Review distribution</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Eligible recipients, owed amounts, and checkpoint state below come
          from the same checkpoint engine the community operator console
          uses. Distribution pays only when a checkpoint has been reached and
          the confirmed Pool balance covers what is owed - blocked recipients
          (no eligible checkpoint yet, or insufficient balance) are held back
          automatically rather than partially paid.
        </p>
      </section>
      <PoolCheckpointPanel
        communitySlug={target.communitySlug}
        programId={target.programId}
      />
    </div>
  );
}

type FundingIntentStatus = {
  intent: {
    id: string;
    amountUsd: number;
    status: string;
    communitySlug: string | null;
    programId: string | null;
    updatedAt: string;
    transaction: {
      txHash: string | null;
      status: string;
      providerTransactionId: string | null;
    } | null;
    receipt?: {
      id: string;
      txHash: string;
      publicReference: string;
    } | null;
  };
};

function TransactionPanel({ action }: { action: DiscoverAction }) {
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "transaction"
      ? action.presentation.target
      : null;
  const [status, setStatus] = useState<FundingIntentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function refresh(signal?: AbortSignal) {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/capital/funding-intents/${encodeURIComponent(target.fundingIntentId)}`,
        {
          credentials: "include",
          cache: "no-store",
          signal,
        },
      );
      const body = (await response
        .json()
        .catch(() => ({}))) as FundingIntentStatus & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Transaction status could not be loaded");
      setStatus(body);
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Transaction status could not be loaded",
        );
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
    // refresh reads only the stable funding-intent id from target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.fundingIntentId]);
  if (!target) return null;
  const current =
    status?.intent.transaction?.status ?? status?.intent.status ?? "prepared";
  const stages = [
    "Prepared",
    "Authorised",
    "Submitted",
    "Confirmed",
    "Receipt",
  ];
  const reached = status?.intent.receipt
    ? 4
    : current === "confirmed"
      ? 3
      : current === "submitted"
        ? 2
        : ["authorized", "approved"].includes(current)
          ? 1
          : 0;
  return (
    <div className="mt-5 space-y-4">
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading transaction status
        </p>
      ) : null}
      {status ? (
        <>
          <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">
              {status.intent.amountUsd.toFixed(2)} USDC
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {status.intent.communitySlug ?? "Direct support"}
            </p>
            <div className="mt-5 space-y-3">
              {stages.map((stage, index) => (
                <div key={stage} className="flex items-center gap-3 text-sm">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${index <= reached ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10 text-slate-600"}`}
                  >
                    {index < reached ? "✓" : index + 1}
                  </span>
                  <span
                    className={
                      index <= reached ? "text-slate-200" : "text-slate-600"
                    }
                  >
                    {stage}
                  </span>
                </div>
              ))}
            </div>
            {status.intent.transaction?.txHash ? (
              <p className="mt-4 break-all font-mono text-xs text-slate-400">
                {status.intent.transaction.txHash}
              </p>
            ) : null}
            {status.intent.receipt ? (
              <a
                href={`/outcomes/${encodeURIComponent(status.intent.receipt.publicReference)}`}
                className="mt-4 inline-flex text-sm font-medium text-violet-200 hover:text-white"
              >
                Open receipt
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh status
          </button>
        </>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EntityDetailsPanel({
  action,
  data,
}: {
  action: DiscoverAction;
  data: DiscoverPageData;
}) {
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "entity_details"
      ? action.presentation.target
      : null;
  if (!target) return null;
  if (target.entityType === "person") {
    const person = data.people.find((item) => item.id === target.subjectId);
    if (!person)
      return (
        <p className="mt-5 text-sm text-slate-400">
          This person is no longer available in the current persisted result.
        </p>
      );
    return (
      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-400/10 font-semibold text-violet-100">
              {person.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h3 className="font-semibold text-white">{person.name}</h3>
              <p className="mt-1 text-xs capitalize text-slate-500">
                {person.identityState.replaceAll("_", " ")}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Accepted work</dt>
              <dd className="mt-1 text-white">{person.completedWork ?? 0}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Payout readiness</dt>
              <dd className="mt-1 capitalize text-white">
                {person.payoutReadiness.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Identities</dt>
              <dd className="mt-1 text-white">
                {person.verifiedIdentities.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Communities</dt>
              <dd className="mt-1 text-white">
                {person.communities.join(", ") || "No public community role"}
              </dd>
            </div>
          </dl>
        </div>
        {person.profilePath ? (
          <a
            href={person.profilePath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200"
          >
            Open source identity
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    );
  }
  if (target.entityType === "pool") {
    const pool = data.pools.find((item) => item.id === target.subjectId);
    if (!pool)
      return (
        <p className="mt-5 text-sm text-slate-400">
          This Pool is no longer available in the current persisted result.
        </p>
      );
    const progress =
      pool.targetUsd && pool.targetUsd > 0 && pool.balanceUsd != null
        ? Math.min(100, (pool.balanceUsd / pool.targetUsd) * 100)
        : null;
    return (
      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <p className="text-xs text-emerald-300">{pool.communitySlug}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{pool.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {pool.purpose ?? pool.type}
          </p>
          <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Confirmed funding</dt>
              <dd className="mt-1 text-white">
                {pool.balanceUsd != null
                  ? `$${pool.balanceUsd.toFixed(2)} USDC`
                  : "Not confirmed"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Pending</dt>
              <dd className="mt-1 text-white">
                {pool.pendingDepositsUsd != null
                  ? `$${pool.pendingDepositsUsd.toFixed(2)} USDC`
                  : "None recorded"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Target</dt>
              <dd className="mt-1 text-white">
                {pool.targetUsd != null
                  ? `$${pool.targetUsd.toFixed(2)} USDC`
                  : "Open ended"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Funding rule</dt>
              <dd className="mt-1 capitalize text-white">
                {pool.policyState.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Treasury</dt>
              <dd className="mt-1 capitalize text-white">
                {pool.treasuryReadiness.replaceAll("_", " ")}
              </dd>
            </div>
          </dl>
          {progress != null ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-white/[0.08] p-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>Funder</span>
            <span>-&gt;</span>
            <span>Pool treasury</span>
            <span>-&gt;</span>
            <span>Funding rule</span>
            <span>-&gt;</span>
            <span>Eligible work</span>
            <span>-&gt;</span>
            <span>Recipients</span>
            <span>-&gt;</span>
            <span>Receipts</span>
          </div>
        </div>
      </div>
    );
  }
  if (target.entityType === "program") {
    const program = data.opportunities.items.find(
      (item) =>
        item.source.id === target.subjectId &&
        item.marketplaceKind === "program",
    );
    if (!program)
      return (
        <p className="mt-5 text-sm text-slate-400">
          This Program is no longer available in the current persisted result.
        </p>
      );
    return (
      <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <p className="text-xs text-cyan-300">{program.community?.name}</p>
        <h3 className="mt-1 text-lg font-semibold text-white">
          {program.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {program.summary}
        </p>
        <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Recognised activity</dt>
            <dd className="mt-1 text-white">
              {program.deliverables.join(", ") ||
                program.category ||
                "Configured source activity"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Current policy</dt>
            <dd className="mt-1 capitalize text-white">
              {program.entityState?.financialReadiness === "ready"
                ? "Active"
                : "Review required"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Source</dt>
            <dd className="mt-1 text-white">
              {program.repository ?? program.source.type.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Template</dt>
            <dd className="mt-1 text-white">
              {program.program?.templateId.replaceAll("-", " ")}
            </dd>
          </div>
        </dl>
      </div>
    );
  }
  const community = data.communities.find(
    (item) => item.id === target.subjectId || item.slug === target.subjectId,
  );
  if (!community)
    return (
      <p className="mt-5 text-sm text-slate-400">
        This Community is no longer available in the current persisted result.
      </p>
    );
  return (
    <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <h3 className="text-lg font-semibold text-white">{community.name}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {community.purpose}
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-slate-500">Activity</dt>
          <dd className="mt-1 text-white">
            {community.activeOpportunities ?? 0}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Pools</dt>
          <dd className="mt-1 text-white">{community.activePools ?? 0}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Type</dt>
          <dd className="mt-1 text-white">{community.type}</dd>
        </div>
      </dl>
    </div>
  );
}

type EvidenceDetail = {
  evidenceId: string;
  provider: string;
  event: string;
  kind: string;
  actor: string | null;
  acceptedAt: string;
  recordedAt: string;
  sourceUrl: string;
  repository?: string;
  workType?: string;
  sourceKind?: string;
  title?: string;
  verificationState?: string;
  freshness?: string;
  attributionState?: string;
};

function EvidencePanel({
  action,
  item,
}: {
  action: DiscoverAction;
  item?: EconomicActionItem;
}) {
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "evidence"
      ? action.presentation.target
      : null;
  const [evidence, setEvidence] = useState<EvidenceDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!target?.evidenceIds.length) return;
    const controller = new AbortController();
    setError(null);
    void fetch(
      `/api/discover/evidence?ids=${encodeURIComponent(target.evidenceIds.join(","))}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          evidence?: EvidenceDetail[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(body.error ?? "Evidence could not be loaded");
        setEvidence(body.evidence ?? []);
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Evidence could not be loaded",
          );
        }
      });
    return () => controller.abort();
  }, [reload, target]);
  if (!target) return null;
  if (error)
    return (
      <div className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/[0.05] p-4">
        <p role="alert" className="text-sm text-rose-100">
          {error}
        </p>
        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-white"
        >
          Retry
        </button>
      </div>
    );
  if (!evidence)
    return (
      <p className="mt-5 flex items-center gap-2 text-sm text-slate-400">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading persisted evidence
      </p>
    );
  if (!evidence.length)
    return (
      <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-100">
        The source snapshot exists, but no eligible Evidence row was found.
        Funding remains unavailable.
      </p>
    );
  return (
    <div className="mt-5 space-y-4">
      {evidence.map((row) => (
        <article
          key={row.evidenceId}
          className="rounded-xl border border-white/[0.08] bg-black/20 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-cyan-300">
                {row.provider} accepted event
              </p>
              <h3 className="mt-1 font-semibold text-white">
                {row.title ?? item?.happened ?? row.event}
              </h3>
            </div>
            <span className="rounded-full border border-emerald-300/20 px-2 py-1 text-[10px] text-emerald-200">
              {row.verificationState?.replaceAll("_", " ") ?? "Verified source"}
            </span>
          </div>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Evidence ID</dt>
              <dd className="mt-1 break-all font-mono text-white">
                {row.evidenceId}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Event</dt>
              <dd className="mt-1 text-white">{row.event}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Repository</dt>
              <dd className="mt-1 text-white">
                {row.repository ?? target.repository ?? "GitHub"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Contributor</dt>
              <dd className="mt-1 text-white">
                {row.actor ? `@${row.actor}` : "Unattributed"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Accepted</dt>
              <dd className="mt-1 text-white">
                {new Date(row.acceptedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Attribution</dt>
              <dd className="mt-1 capitalize text-white">
                {row.attributionState?.replaceAll("_", " ") ??
                  "Observed from source"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Work type</dt>
              <dd className="mt-1 capitalize text-white">
                {row.workType?.replaceAll("_", " ") ??
                  row.sourceKind?.replaceAll("_", " ") ??
                  "Accepted activity"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Program coverage</dt>
              <dd className="mt-1 text-white">
                {item?.blocker ?? "No active funding policy is attached."}
              </dd>
            </div>
          </dl>
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200"
          >
            Open GitHub evidence
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </article>
      ))}
    </div>
  );
}

type AgentInvokeResult = {
  ok?: boolean;
  error?: string;
  serviceName?: string;
  amountUsd?: number;
  txRef?: string | null;
  meteringMode?: string;
  receiptHref?: string | null;
  taskId?: string;
  provider?: string;
  completedAt?: string;
  summary?: { headline?: string; detail?: string };
  execution?: {
    steps?: string[];
    findings?: string[];
    recommendations?: string[];
    deliverables?: string[];
  } | null;
  payment?: {
    txHash: string;
    explorerUrl: string;
    chargedUsd: number;
    balanceUsd: number;
  };
};

function AgentServicePanel({
  action,
  data,
  signedIn,
}: {
  action: DiscoverAction;
  data: DiscoverPageData;
  signedIn: boolean;
}) {
  const target =
    action.presentation.kind === "workbench" &&
    action.presentation.target.panel === "agent_service"
      ? action.presentation.target
      : null;
  const service = target
    ? data.agentMarketplace.services.find(
        (candidate) => candidate.id === target.subjectId,
      )
    : undefined;
  const priceUsd = service?.priceUsd ?? 0;
  const [quotedPriceUsd, setQuotedPriceUsd] = useState<number | null>(null);
  const [quotedAt, setQuotedAt] = useState<string | null>(null);
  const [quotePending, setQuotePending] = useState(false);
  const effectivePriceUsd = quotedPriceUsd ?? priceUsd;
  const walletChoice = useFundingWalletChoice(effectivePriceUsd);
  const { payAgentSignalWithWallet } = useResolveAccess();
  const [prompt, setPrompt] = useState(service?.examplePrompt ?? "");
  const [maxSpend, setMaxSpend] = useState(
    String(Math.max(0.05, priceUsd * 2)),
  );
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState("Ready for review");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentInvokeResult | null>(null);

  useEffect(() => {
    setPrompt(service?.examplePrompt ?? "");
    setMaxSpend(String(Math.max(0.05, (service?.priceUsd ?? 0) * 2)));
    setReviewed(false);
    setError(null);
    setResult(null);
    setQuotedPriceUsd(null);
    setQuotedAt(null);
    setQuotePending(false);
    setStage("Ready for review");
  }, [service?.examplePrompt, service?.id, service?.priceUsd]);

  if (!target || !service) {
    return (
      <p role="alert" className="mt-5 text-sm text-rose-200">
        This service is no longer present in the registered provider catalog.
      </p>
    );
  }
  const selectedService = service;

  const maxSpendUsd = Number(maxSpend);
  const capValid =
    Number.isFinite(maxSpendUsd) && maxSpendUsd >= effectivePriceUsd;
  const canQuote = Boolean(
    service.available && prompt.trim() && capValid && !pending && !quotePending,
  );
  const canReview = Boolean(
    signedIn &&
      service.available &&
      quotedPriceUsd !== null &&
      prompt.trim() &&
      capValid &&
      walletChoice.fundingSource &&
      !pending,
  );

  async function getCurrentQuote() {
    if (!canQuote) return;
    setQuotePending(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/services", {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as {
        services?: Array<{ id?: unknown; priceUsd?: unknown }>;
        updatedAt?: unknown;
      } | null;
      const current = body?.services?.find(
        (candidate) => candidate.id === selectedService.id,
      );
      if (
        !response.ok ||
        !current ||
        typeof current.priceUsd !== "number" ||
        !Number.isFinite(current.priceUsd) ||
        current.priceUsd <= 0
      ) {
        throw new Error("The provider did not return a valid current quote.");
      }
      setQuotedPriceUsd(current.priceUsd);
      setQuotedAt(
        typeof body?.updatedAt === "string"
          ? body.updatedAt
          : new Date().toISOString(),
      );
      if (current.priceUsd > maxSpendUsd) {
        throw new Error(
          `Price changed to ${current.priceUsd.toFixed(3)} USDC. Your maximum is ${maxSpendUsd.toFixed(3)} USDC. Review the new price before continuing.`,
        );
      }
      setReviewed(true);
      setStage("Current quote ready for review");
    } catch (reason) {
      setReviewed(false);
      setError(
        reason instanceof Error
          ? reason.message
          : "The current quote could not be loaded.",
      );
    } finally {
      setQuotePending(false);
    }
  }

  async function runService() {
    if (!canReview || !reviewed) return;
    setPending(true);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 90_000);
    let paymentTxHash: string | undefined;
    try {
      const fundingSource = walletChoice.assertFundingSource();
      if (fundingSource === "external") {
        setStage("Waiting for the connected-wallet Arc signature");
        const paid = await payAgentSignalWithWallet(effectivePriceUsd);
        paymentTxHash = paid.txHash;
      } else {
        setStage("Submitting the Arc charge from the RESOLVE wallet");
      }
      setStage("Running the service with the authorised spend cap");
      const response = await fetch("/api/agent/invoke", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          serviceId: selectedService.id,
          prompt: prompt.trim(),
          text: prompt.trim(),
          maxSpendUsd,
          paymentTxHash,
        }),
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as AgentInvokeResult;
      setResult(body);
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `Service run failed (${response.status})`);
      }
      setStage("Result returned and execution recorded");
      await walletChoice.spendable.refresh().catch(() => null);
    } catch (reason) {
      const message =
        reason instanceof DOMException && reason.name === "AbortError"
          ? "The service did not return before the 90-second timeout. Check the recorded Arc transaction before retrying."
          : reason instanceof Error
            ? reason.message
            : "The service run failed.";
      setError(message);
      setStage(paymentTxHash ? "Payment submitted, result needs review" : "Run failed before payment confirmation");
    } finally {
      window.clearTimeout(timer);
      setPending(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-cyan-300">
              {service.provider}
            </p>
            <h3 className="mt-1 font-semibold text-white">{service.name}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {service.description}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white">
            {effectivePriceUsd.toFixed(3)} USDC
          </span>
        </div>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Billing unit</dt>
            <dd className="mt-1 text-white">Per {service.billingUnit}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Payment rail</dt>
            <dd className="mt-1 text-white">{service.paymentRail}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Expected result</dt>
            <dd className="mt-1 text-white">
              {service.deliverables.join(" / ")}
            </dd>
          </div>
        </dl>
      </section>

      {service.decisionContext ? (
        <section className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-xs">
          <div>
            <p className="font-semibold text-violet-300">When this is useful</p>
            <p className="mt-1 leading-6 text-slate-300">{service.decisionContext.useWhen}</p>
          </div>
          <div className="mt-3">
            <p className="font-semibold text-slate-400">What it returns</p>
            <p className="mt-1 leading-5 text-slate-400">{service.decisionContext.produces}</p>
          </div>
          <div className="mt-3">
            <p className="font-semibold text-amber-200">Limitations</p>
            <p className="mt-1 leading-5 text-slate-400">{service.decisionContext.limitations}</p>
          </div>
        </section>
      ) : null}

      {!service.available ? (
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
          <p className="font-semibold text-amber-100">
            Paid execution is unavailable
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            {service.blocker}. RESOLVE will not request a wallet signature,
            charge USDC, or claim a service result while this requirement is
            unresolved.
          </p>
        </div>
      ) : (
        <>
          <label className="block text-xs text-slate-400">
            Service input
            <textarea
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setReviewed(false);
              }}
              disabled={pending || reviewed}
              rows={5}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-white outline-none focus:border-violet-300/50"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Maximum spend in USDC
            <input
              type="number"
              min={effectivePriceUsd}
              step="0.001"
              value={maxSpend}
              onChange={(event) => {
                setMaxSpend(event.target.value);
                setReviewed(false);
              }}
              disabled={pending || reviewed}
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <PayFromWalletSection
            amountUsd={effectivePriceUsd}
            disabled={pending || reviewed}
            choice={walletChoice}
          />
          {reviewed ? (
            <section className="rounded-xl border border-violet-300/20 bg-violet-300/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">Review purchase</h3>
                <button
                  type="button"
                  onClick={() => setReviewed(false)}
                  className="text-xs text-violet-200"
                >
                  Modify
                </button>
              </div>
              <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Service</dt>
                  <dd className="mt-1 text-white">{service.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Provider</dt>
                  <dd className="mt-1 text-white">{service.provider}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Price</dt>
                  <dd className="mt-1 text-white">
                    {effectivePriceUsd.toFixed(3)} USDC
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Maximum spend</dt>
                  <dd className="mt-1 text-white">
                    {maxSpendUsd.toFixed(3)} USDC
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Pay from</dt>
                  <dd className="mt-1 capitalize text-white">
                    {walletChoice.fundingSource === "app"
                      ? "RESOLVE wallet"
                      : "Connected wallet"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Network</dt>
                  <dd className="mt-1 text-white">Arc Testnet</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Network fee</dt>
                  <dd className="mt-1 text-white">
                    Not separately quoted by the current payment provider
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">USDC service total</dt>
                  <dd className="mt-1 text-white">
                    {effectivePriceUsd.toFixed(3)} USDC
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Quote checked</dt>
                  <dd className="mt-1 text-white">
                    {quotedAt ? new Date(quotedAt).toLocaleString() : "Not checked"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-amber-100">
                Authorising pays once for this run. A connected wallet asks for
                a human signature. A RESOLVE wallet submits through the
                canonical Circle-managed path.
              </p>
            </section>
          ) : null}
          <button
            type="button"
            data-action-id={
              reviewed
                ? "discover.run_agent_service"
                : "discover.quote_agent_service"
            }
            disabled={reviewed ? !canReview || pending : !canQuote}
            onClick={() => {
              if (!reviewed) void getCurrentQuote();
              else void runService();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending || quotePending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            {quotePending
              ? "Getting current quote"
              : pending
              ? stage
              : reviewed
                ? `Authorise and run for ${effectivePriceUsd.toFixed(3)} USDC`
                : "Get current quote"}
          </button>
        </>
      )}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-sm leading-6 text-rose-100"
        >
          <p>{error}</p>
          {result?.payment?.explorerUrl ? (
            <a
              href={result.payment.explorerUrl}
              data-action-id="receipt.open_arcscan"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 font-medium text-rose-50 underline underline-offset-4"
            >
              Check the submitted Arc transaction before retrying
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      ) : null}
      {result?.ok ? (
        <section className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
          <div className="flex items-center gap-2 text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <strong>{result.summary?.headline ?? "Service completed"}</strong>
          </div>
          {result.summary?.detail ? (
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {result.summary.detail}
            </p>
          ) : null}
          {result.execution?.findings?.length ? (
            <ul className="mt-3 space-y-1 text-xs text-slate-300">
              {result.execution.findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          ) : null}
          <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-xs">
            <dt className="text-slate-500">Charged</dt>
            <dd className="text-white">
              {(result.payment?.chargedUsd ?? result.amountUsd ?? effectivePriceUsd).toFixed(3)} USDC
            </dd>
            <dt className="text-slate-500">Task</dt>
            <dd className="break-all text-white">{result.taskId ?? "Recorded"}</dd>
            <dt className="text-slate-500">Provider</dt>
            <dd className="text-white">{result.provider ?? service.provider}</dd>
            <dt className="text-slate-500">Completed</dt>
            <dd className="text-white">
              {result.completedAt
                ? new Date(result.completedAt).toLocaleString()
                : "Recorded by provider"}
            </dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {result.receiptHref ? (
              <a
                href={result.receiptHref}
                data-action-id="receipt.open"
                className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white"
              >
                View result record
              </a>
            ) : null}
            {result.payment?.explorerUrl ? (
              <a
                href={result.payment.explorerUrl}
                data-action-id="receipt.open_arcscan"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200"
              >
                Open ArcScan
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function InformationalPanel({
  action,
  item,
}: {
  action: DiscoverAction;
  item?: EconomicActionItem;
}) {
  const target =
    action.presentation.kind === "workbench"
      ? action.presentation.target
      : null;
  if (!target) return null;
  if (target.panel === "evidence")
    return <EvidencePanel action={action} item={item} />;
  if (target.panel === "receipt")
    return (
      <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
        <div className="flex items-center gap-2 text-emerald-200">
          <CheckCircle2 className="h-5 w-5" />
          Confirmed outcome
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {item?.happened}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={target.receiptUrl}
            className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white"
          >
            Open receipt
          </a>
          {target.explorerUrl ? (
            <a
              href={target.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200"
            >
              Open ArcScan
            </a>
          ) : null}
        </div>
      </div>
    );
  return null;
}

export function DiscoverActionWorkbench({
  action,
  item,
  data,
  onClose,
}: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const { openSignIn } = useSignInModal();
  const target =
    action?.presentation.kind === "workbench"
      ? action.presentation.target
      : null;
  const authenticationRequired = Boolean(
    target &&
    !data.signedIn &&
    ([
      "payout_destination",
      "direct_support",
      "work_funding",
      "pool_funding",
      "support_bundle",
      "request",
      "program_setup",
      "source_sync",
      "authorization_review",
      "transaction",
      "pool_distribution",
    ].includes(target.panel) ||
      (target.panel === "agent_service" &&
        action?.id === "discover.run_agent_service")),
  );
  useEffect(() => {
    if (!action || !target) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hasAttribute("hidden"));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [action, onClose, target]);
  const financial =
    target?.panel === "direct_support" ||
    target?.panel === "work_funding" ||
    target?.panel === "pool_funding" ||
    target?.panel === "support_bundle" ||
    target?.panel === "request" ||
    target?.panel === "agent_service" ||
    target?.panel === "pool_distribution";
  const title = useMemo(
    () => (action ? titleFor(action) : "Discover action"),
    [action],
  );
  if (!action || !target) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-[65] bg-black/65"
        role="presentation"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) onClose();
        }}
      >
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discover-workbench-title"
          className={`ml-auto h-full w-full overflow-y-auto border-l border-white/10 bg-[#060d17] p-5 shadow-2xl sm:p-6 ${financial ? "max-w-[620px]" : "max-w-[560px]"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-violet-300">Discover</p>
              <h2
                id="discover-workbench-title"
                className="mt-1 text-xl font-semibold text-white"
              >
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Review and complete this action without losing your marketplace
                context.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close Discover action"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {authenticationRequired ? (
            <div className="mt-5 rounded-xl border border-violet-300/20 bg-violet-300/[0.05] p-4">
              <h3 className="font-semibold text-white">Sign in to continue</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Connect your wallet and sign a message to authenticate your
                RESOLVE session. This doesn&apos;t send USDC or create an
                onchain transaction.
              </p>
              <button
                type="button"
                onClick={openSignIn}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white"
              >
                Connect wallet
              </button>
            </div>
          ) : (
            <>
              {target.panel === "direct_support" ||
              target.panel === "work_funding" ? (
                <RecipientPaymentPanel
                  action={action}
                  onClose={onClose}
                  signedIn={data.signedIn}
                />
              ) : null}
              {target.panel === "pool_funding" ? (
                <PoolFundingPanel action={action} signedIn={data.signedIn} />
              ) : null}
              {target.panel === "support_bundle" ? (
                <SupportBundlePanel action={action} />
              ) : null}
              {target.panel === "request" ? (
                <RequestPanel action={action} onClose={onClose} />
              ) : null}
              {target.panel === "agent_service" ? (
                <AgentServicePanel
                  action={action}
                  data={data}
                  signedIn={data.signedIn}
                />
              ) : null}
              {target.panel === "source_sync" ? (
                <SourceSyncPanel action={action} />
              ) : null}
              {target.panel === "program_setup" ? (
                <ProgramSetupPanel action={action} item={item} />
              ) : null}
              {target.panel === "pool_distribution" ? (
                <PoolDistributionPanel action={action} />
              ) : null}
              {target.panel === "authorization_review" ? (
                <AuthorizationReviewPanel action={action} />
              ) : null}
              {target.panel === "transaction" ? (
                <TransactionPanel action={action} />
              ) : null}
              {target.panel === "entity_details" ? (
                <EntityDetailsPanel action={action} data={data} />
              ) : null}
              {![
                "direct_support",
                "work_funding",
                "pool_funding",
                "support_bundle",
                "request",
                "source_sync",
                "program_setup",
                "authorization_review",
                "payout_destination",
                "transaction",
                "entity_details",
                "agent_service",
              ].includes(target.panel) ? (
                <InformationalPanel action={action} item={item} />
              ) : null}
              {target.panel === "payout_destination" ? (
                <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm text-slate-300">
                  <WalletCards className="mb-3 h-5 w-5 text-violet-300" />
                  Review the available wallet destinations and select where
                  future RESOLVE earnings should settle. No destination is
                  selected automatically.
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
      <PayoutDestinationDrawer
        open={shouldOpenPayoutDestination(target.panel, data.signedIn)}
        origin="discover"
        onClose={onClose}
      />
    </>
  );
}
