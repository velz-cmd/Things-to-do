"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Cpu,
  ExternalLink,
  FileCheck2,
  Loader2,
  Radar,
  Receipt,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/resolve/ui/button";
import { ArcTxLink } from "@/components/resolve/ui/arc-tx-link";
import { ArcWalletLink } from "@/components/resolve/ui/arc-wallet-link";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";
import { matchServiceForPrompt } from "@/lib/agent/commerce-match";
import { MISSION_AGENT_LANE_COPY } from "@/lib/mission/mission-lane-copy";
import { MissionBlueprintPanel } from "@/components/resolve/mission-control/mission-blueprint-panel";
import {
  AGENT_INVOKE_STEPS,
  MissionProgressStepCard,
} from "@/components/resolve/mission-control/mission-progress-step-card";
import { apiFetchWallet } from "@/lib/discover/discover-action-engine";
import {
  getMissionAgentBudgetCap,
  setMissionAgentBudgetCap,
} from "@/lib/mission/mission-agent-budget";
import { getAgentSignalService } from "@/lib/agent/service-registry";
import { useFundingWalletChoice } from "@/hooks/use-funding-wallet-choice";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { PayFromWalletSection } from "@/components/resolve/fund/pay-from-wallet-section";

const CATALOG_CACHE_KEY = "resolve-agent-services-cache";
const CATALOG_CACHE_MS = 5 * 60_000;

function readCatalogCache(): ServicesPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: ServicesPayload };
    if (Date.now() - parsed.at > CATALOG_CACHE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCatalogCache(data: ServicesPayload) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota */
  }
}

const CHAINED_SIGNALS = [
  {
    id: "sentiment-per-request",
    label: "Sentiment pass",
    promptSuffix: "Classify maintainer sentiment from recent feedback threads.",
    priceHint: 0.001,
  },
  {
    id: "docs-review",
    label: "Docs depth",
    promptSuffix: "Deep docs gap review for top maintainers.",
    priceHint: 0.02,
  },
  {
    id: "security-signal",
    label: "CVE scan",
    promptSuffix: "Extract security advisories affecting this ecosystem.",
    priceHint: 0.1,
  },
] as const;

export type AgentServiceCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  priceUsd: number;
  billingUnit: string;
  domain: string;
  eventType: string;
  examplePrompt: string;
  deliverables?: string[];
  x402: boolean;
};

type ServicesPayload = {
  ok: boolean;
  gatewayEnabled: boolean;
  services: AgentServiceCard[];
  tagline?: string;
  feePath?: {
    flow: string[];
    platformFeeBps: number;
    platformFeeUsd: number;
    note: string;
  };
};

type ExecutionReport = {
  steps: string[];
  findings: string[];
  recommendations: string[];
  deliverables: string[];
  inputPreview: string;
};

type InvokeResult = {
  ok: boolean;
  serviceName?: string;
  amountUsd?: number;
  authorizationId?: string;
  receiptHref?: string | null;
  meteringMode?: string;
  summary?: { headline: string; detail: string };
  execution?: ExecutionReport | null;
  payment?: {
    txHash: string;
    explorerUrl: string;
    chargedUsd: number;
    balanceUsd: number;
    previousBalanceUsd: number;
    onChainUsd: number | null;
  };
  wallet?: {
    chargedUsd: number;
    balanceUsd: number;
    previousBalanceUsd: number;
  };
  error?: string;
};

const FOLLOW_UP_SUGGESTIONS = [
  {
    label: "Fund maintainers from findings",
    prompt: "Turn these maintainer signals into a funding plan for the top contributors.",
  },
  {
    label: "Install a community program",
    prompt: "Help me install a maintainer program for this ecosystem.",
  },
  {
    label: "Run another signal",
    prompt: "What other agent signals would help this mission?",
  },
] as const;

const FAILURE_FOLLOW_UPS = [
  {
    label: "Open royalty settlement",
    prompt:
      "Prepare royalty settlement for independent music artists — show play-weighted payees.",
  },
  {
    label: "Try labeled attribution",
    prompt: "artist: Luna Hart · track: Midnight Echo — parse attribution for royalty routing.",
  },
  {
    label: "Skip paid agent",
    prompt: "Skip paid agent signal — give me a free analysis path for this objective.",
  },
] as const;

function chargedUsdDisplay(amount: number): boolean {
  return amount >= 0.0001;
}

function signalExecutionFailed(execution?: ExecutionReport | null): boolean {
  if (!execution?.findings?.length) return false;
  return execution.findings.some((f) =>
    /could not extract|no labeled fields|paste full advisory|no cve/i.test(f),
  );
}

function compactAddress(address?: string) {
  if (!address) return "Wallet provisioning";
  if (address.length < 13) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function CompactWalletSelector({
  amountUsd,
  disabled,
  choice,
}: {
  amountUsd: number;
  disabled?: boolean;
  choice: ReturnType<typeof useFundingWalletChoice>;
}) {
  const options = [
    {
      id: "app" as const,
      label: "RESOLVE wallet",
      address: choice.spendable.appWalletAddress,
      balance: choice.spendable.appSpendableUsd,
      ready: choice.spendable.appSpendableUsd >= amountUsd,
    },
    ...(choice.hasLinkedExternal || choice.externalWalletReady
      ? [{
          id: "external" as const,
          label: "Connected wallet",
          address: choice.spendable.externalWalletAddress,
          balance: choice.spendable.externalSpendableUsd,
          ready: choice.externalWalletReady && choice.spendable.externalSpendableUsd >= amountUsd,
        }]
      : []),
  ];

  return (
    <div className="mission-wallet-selector" role="radiogroup" aria-label="Pay from">
      {options.map((option) => {
        const selected = choice.fundingSource === option.id;
        const reconnect = option.id === "external" && !choice.externalWalletReady;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={clsx(selected && "is-selected", !option.ready && "is-unavailable")}
            onClick={() => {
              if (reconnect) choice.openConnectWallet();
              choice.setChosenWallet(option.id);
            }}
          >
            <span className="mission-wallet-selector__radio">{selected && <Check className="h-3 w-3" />}</span>
            <span className="mission-wallet-selector__identity">
              <strong>{option.label}</strong>
              <small>{compactAddress(option.address)}</small>
            </span>
            <span className="mission-wallet-selector__balance">
              <strong>${option.balance.toFixed(2)}</strong>
              <small>{reconnect ? "Reconnect" : option.ready ? "Available" : "Insufficient"}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MissionAgentSignalCard({
  prompt,
  initialServiceId,
  onFollowUp,
}: {
  prompt: string;
  initialServiceId?: string;
  onFollowUp?: (text: string) => void;
}) {
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const { payAgentSignalWithWallet } = useResolveAccess();
  const signedIn = Boolean(user);

  const [catalog, setCatalog] = useState<ServicesPayload | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [serviceId, setServiceId] = useState(initialServiceId ?? "");
  const [agentCapUsd, setAgentCapUsd] = useState(() => getMissionAgentBudgetCap());
  const [walletUsd, setWalletUsd] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [invoking, setInvoking] = useState(false);
  const [invokeStage, setInvokeStage] = useState<"idle" | "charging" | "running">("idle");
  const [payDecision, setPayDecision] = useState<"pending" | "pay" | "skip">("pending");
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [chainSteps, setChainSteps] = useState<
    Array<{ serviceName: string; chargedUsd: number; headline: string }>
  >([]);

  const loadCatalog = useCallback(async () => {
    const cached = readCatalogCache();
    if (cached?.services?.length) {
      setCatalog(cached);
      if (!serviceId) {
        const matched = matchServiceForPrompt(prompt);
        setServiceId(matched?.id ?? cached.services[0]?.id ?? "");
      }
      setLoadingCatalog(false);
    } else {
      setLoadingCatalog(true);
    }
    try {
      const res = await fetch("/api/agent/services");
      const data = (await res.json()) as ServicesPayload;
      setCatalog(data);
      writeCatalogCache(data);
      if (!serviceId) {
        const matched = matchServiceForPrompt(prompt);
        setServiceId(matched?.id ?? data.services[0]?.id ?? "");
      }
    } finally {
      setLoadingCatalog(false);
    }
  }, [prompt, serviceId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (initialServiceId) setServiceId(initialServiceId);
  }, [initialServiceId]);

  useEffect(() => {
    if (!signedIn) {
      setWalletUsd(null);
      return;
    }
    void apiFetchWallet().then((w) => {
      setWalletUsd(w.spendableUsd);
      if (w.address) setWalletAddress(w.address);
    });
  }, [signedIn, result?.wallet?.balanceUsd]);

  const selected = useMemo(
    () => catalog?.services.find((s) => s.id === serviceId) ?? catalog?.services[0],
    [catalog?.services, serviceId],
  );

  const pricePreview = selected?.priceUsd ?? 0.001;
  const walletChoice = useFundingWalletChoice(pricePreview);
  const canAfford =
    walletChoice.fundingSource != null ||
    walletUsd == null ||
    walletUsd >= pricePreview;

  async function runAgent(overrideServiceId?: string, chainLabel?: string) {
    const runServiceId = overrideServiceId ?? serviceId;
    if (!signedIn) {
      openSignIn();
      return;
    }
    if (!prompt.trim() || !runServiceId) {
      toast.error("Enter a prompt and pick a service");
      return;
    }
    try {
      walletChoice.assertFundingSource();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pick a wallet to pay from");
      return;
    }
    setInvoking(true);
    setInvokeStage("charging");
    if (!chainLabel) setResult(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 75_000);
    let paymentTxHash: string | undefined;
    try {
      const source = walletChoice.fundingSource;
      if (source === "external") {
        const paid = await payAgentSignalWithWallet(pricePreview);
        paymentTxHash = paid.txHash;
      }

      const res = await fetch("/api/agent/invoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          serviceId: runServiceId,
          prompt: chainLabel ? `${prompt.trim()} — ${chainLabel}` : prompt.trim(),
          text: chainLabel ? `${prompt.trim()} — ${chainLabel}` : prompt.trim(),
          maxSpendUsd: agentCapUsd,
          paymentTxHash,
        }),
      });
      setInvokeStage("running");
      const data = (await res.json().catch(() => ({}))) as InvokeResult;
      if (!res.ok && !data.error) {
        data.error = `Agent invoke failed (${res.status})`;
        data.ok = false;
      }
      setResult(data);
      if (data.ok && chainLabel) {
        setChainSteps((prev) => [
          ...prev,
          {
            serviceName: data.serviceName ?? chainLabel,
            chargedUsd: data.payment?.chargedUsd ?? data.wallet?.chargedUsd ?? data.amountUsd ?? 0,
            headline: data.summary?.headline ?? chainLabel,
          },
        ]);
      }
      if (data.wallet?.balanceUsd != null) {
        setWalletUsd(data.wallet.balanceUsd);
      } else if (data.payment?.balanceUsd != null) {
        setWalletUsd(data.payment.balanceUsd);
      } else if (signedIn) {
        const w = await apiFetchWallet();
        setWalletUsd(w.spendableUsd);
        if (w.address) setWalletAddress(w.address);
      }
      if (data.ok) {
        toast.success(data.summary?.headline ?? "Agent signal complete", {
          description: data.payment
            ? `${formatAgentPrice(data.payment.chargedUsd)} on Arc · balance $${data.payment.balanceUsd.toFixed(2)}`
            : undefined,
        });
      } else {
        toast.error(data.error ?? "Agent invoke failed");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        const err = "Agent invoke timed out after 75s";
        toast.error(err, {
          description:
            "Check Arcscan on your wallet — if charged, refresh. Otherwise retry or use Skip for free analysis.",
        });
        setResult({ ok: false, error: err });
      } else {
        const err = e instanceof Error ? e.message : "Could not run agent task";
        toast.error(err);
        setResult({ ok: false, error: err });
      }
    } finally {
      window.clearTimeout(timeout);
      setInvoking(false);
      setInvokeStage("idle");
    }
  }

  const totalChargedUsd = useMemo(() => {
    const base =
      result?.payment?.chargedUsd ?? result?.wallet?.chargedUsd ?? result?.amountUsd ?? 0;
    const chain = chainSteps.reduce((s, c) => s + c.chargedUsd, 0);
    return base + chain;
  }, [result, chainSteps]);

  if (loadingCatalog && !catalog) {
    return (
      <div className="flex items-center gap-2 text-sm text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading signal catalog…
      </div>
    );
  }

  return (
    <div className="mission-agent-workspace">

      {!result && selected && payDecision === "pending" && (
        <div className="mission-agent-execution">
          <section className="mission-agent-objective-strip">
            <span className="mission-agent-block-icon mission-agent-block-icon--violet"><Target className="h-4 w-4" /></span>
            <div>
              <p>Objective</p>
              <h3>{prompt}</h3>
              <span>Agent mode · verified context signal</span>
            </div>
          </section>

          <section className="mission-agent-signal-block">
            <div className="mission-agent-block-heading">
              <span className="mission-agent-block-icon mission-agent-block-icon--amber"><Radar className="h-4 w-4" /></span>
              <div><p>Signal</p><h3>{selected.name}</h3></div>
              <span className="mission-agent-price">{formatAgentPrice(pricePreview)} USDC</span>
            </div>
            <dl className="mission-agent-signal-grid">
              <div><dt>Returns</dt><dd>{selected.deliverables?.slice(0, 2).join(" · ") || selected.tagline}</dd></div>
              <div><dt>Source</dt><dd>{selected.domain || "Connected source"}</dd></div>
              <div><dt>Quality</dt><dd><FileCheck2 className="h-3.5 w-3.5" /> Verified context</dd></div>
              <div><dt>Gateway</dt><dd><Cpu className="h-3.5 w-3.5" /> {catalog?.gatewayEnabled ? "Ready" : "Available"}</dd></div>
            </dl>
          </section>

          <section className="mission-agent-payment-block">
            <div className="mission-agent-block-heading">
              <span className="mission-agent-block-icon mission-agent-block-icon--blue"><WalletCards className="h-4 w-4" /></span>
              <div><p>Payment</p><h3>Choose wallet and execution cap</h3></div>
            </div>

            <CompactWalletSelector amountUsd={pricePreview} disabled={invoking} choice={walletChoice} />

            <label className="mission-agent-budget-row">
              <span><strong>Signal budget cap</strong><small>Maximum spend for this run</small></span>
              <input
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={agentCapUsd}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAgentCapUsd(value);
                  setMissionAgentBudgetCap(value);
                }}
              />
              <b>{formatAgentPrice(agentCapUsd)} max</b>
            </label>

            <details className="mission-agent-spend-details">
              <summary>How agent spending works</summary>
              <p>The selected signal is charged once on Arc. The cap prevents this run from exceeding your chosen limit.</p>
            </details>

            <div className="mission-agent-actionbar">
              <Button
                size="sm"
                className="mission-agent-run gap-1.5"
                disabled={!canAfford || invoking}
                onClick={() => {
                  setPayDecision("pay");
                  void runAgent();
                }}
              >
                <CircleDollarSign className="h-3.5 w-3.5" />
                Run {selected.name} · {formatAgentPrice(pricePreview)}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPayDecision("skip");
                  onFollowUp?.(`Skip paid agent signal — give me a free analysis path for: ${prompt.trim()}`);
                }}
              >
                Use free analysis
              </Button>
            </div>
          </section>

          <div className="mission-agent-legacy-payment" hidden>
          <label className="mb-3 block text-[10px] uppercase tracking-wider text-resolve-muted-dim">
            Agent budget cap (mission)
            <input
              type="range"
              min={0.01}
              max={1}
              step={0.01}
              value={agentCapUsd}
              onChange={(e) => {
                const v = Number(e.target.value);
                setAgentCapUsd(v);
                setMissionAgentBudgetCap(v);
              }}
              className="mt-1 block w-full accent-violet-400"
            />
            <span className="text-[11px] text-white">Max {formatAgentPrice(agentCapUsd)} per signal</span>
          </label>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
            {MISSION_AGENT_LANE_COPY.paySkipTitle}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-resolve-muted">
            {MISSION_AGENT_LANE_COPY.paySkipDetail}
          </p>
          <p className="mt-2 text-xs text-white/90">
            Pay{" "}
            <span className="font-semibold text-emerald-300">{formatAgentPrice(pricePreview)}</span>{" "}
            for verified {selected.name} output — or skip and ask Mission for a free analysis path.
          </p>
          <PayFromWalletSection
            amountUsd={pricePreview}
            disabled={invoking}
            choice={walletChoice}
            className="mt-3"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!canAfford || invoking}
              onClick={() => {
                setPayDecision("pay");
                void runAgent();
              }}
            >
              <CircleDollarSign className="h-3.5 w-3.5" />
              Pay · {formatAgentPrice(pricePreview)}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setPayDecision("skip");
                onFollowUp?.(
                  `Skip paid agent signal — give me a free analysis path for: ${prompt.trim()}`,
                );
              }}
            >
              Skip · free analysis
            </Button>
          </div>
          </div>
        </div>
      )}

      {!result && selected && payDecision === "pay" && (
        <MissionProgressStepCard
          active
          title={
            invoking
              ? invokeStage === "charging"
                ? "Charging USDC on Arc"
                : "Running agent signal"
              : "Preparing agent run"
          }
          steps={
            invoking && invokeStage === "running"
              ? AGENT_INVOKE_STEPS.slice(2)
              : AGENT_INVOKE_STEPS
          }
        />
      )}

      {result && (
        <div
          className={clsx(
            "rounded-xl border px-4 py-4",
            result.ok && !signalExecutionFailed(result.execution)
              ? "border-emerald-500/20 bg-emerald-500/[0.04]"
              : "border-rose-500/20 bg-rose-500/[0.04]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={clsx(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  result.ok && !signalExecutionFailed(result.execution)
                    ? "text-emerald-400/90"
                    : "text-rose-400/90",
                )}
              >
                {result.ok && !signalExecutionFailed(result.execution)
                  ? "Agent execution report"
                  : "Signal incomplete"}
              </p>
              <p className="mt-2 text-base font-medium text-white">
                {result.ok && !signalExecutionFailed(result.execution)
                  ? (result.summary?.headline ?? "Complete")
                  : (result.execution?.findings?.[0] ??
                    result.error ??
                    "Could not complete agent signal")}
              </p>
              {result.ok &&
                !signalExecutionFailed(result.execution) &&
                result.summary?.detail && (
                <p className="mt-1 text-sm text-resolve-muted">{result.summary.detail}</p>
              )}
              {signalExecutionFailed(result.execution) && result.execution?.recommendations?.[0] && (
                <p className="mt-1 text-sm text-resolve-muted">
                  {result.execution.recommendations[0]}
                </p>
              )}
            </div>
            {result.ok && !signalExecutionFailed(result.execution) && (
              <Sparkles className="h-5 w-5 shrink-0 text-emerald-400" />
            )}
          </div>

          {result.ok &&
            !signalExecutionFailed(result.execution) &&
            (result.payment ?? result.wallet) &&
            chargedUsdDisplay(
              result.payment?.chargedUsd ?? result.wallet?.chargedUsd ?? 0,
            ) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-100">
              <span>
                <span className="font-semibold tabular-nums">
                  −${(result.payment?.chargedUsd ?? result.wallet?.chargedUsd ?? 0).toFixed(3)}
                </span>{" "}
                USDC sent from your wallet on Arc · was $
                {(result.payment?.previousBalanceUsd ?? result.wallet?.previousBalanceUsd ?? 0).toFixed(2)}{" "}
                → now{" "}
                <span className="font-semibold tabular-nums">
                  ${(result.payment?.balanceUsd ?? result.wallet?.balanceUsd ?? 0).toFixed(2)}
                </span>
                {result.payment?.onChainUsd != null && (
                  <span className="text-emerald-200/80">
                    {" "}
                    (on-chain ${result.payment.onChainUsd.toFixed(2)})
                  </span>
                )}
              </span>
              {result.payment?.txHash && <ArcTxLink txHash={result.payment.txHash} />}
              {walletAddress && <ArcWalletLink address={walletAddress} />}
            </div>
          )}

          {(result.execution?.steps?.length || result.execution?.findings?.length) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(result.execution?.steps?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    What the agent did
                  </p>
                  <ol className="mt-2 space-y-1">
                    {result.execution!.steps.map((step, i) => (
                      <li key={step} className="flex gap-2 text-[11px] text-resolve-muted">
                        <span className="shrink-0 font-mono text-resolve-accent">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {(result.execution?.findings?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    Findings
                  </p>
                  <ul className="mt-2 space-y-1">
                    {result.execution!.findings.map((f) => (
                      <li key={f} className="text-[11px] text-white/90">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(result.execution?.recommendations?.length ?? 0) > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    Recommended next steps
                  </p>
                  <ul className="mt-2 space-y-1">
                    {result.execution!.recommendations.map((r) => (
                      <li key={r} className="flex gap-2 text-[11px] text-resolve-accent">
                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result.ok && !signalExecutionFailed(result.execution) && (
            <div className="mt-4">
              <MissionBlueprintPanel
                prompt={prompt}
                mode="agent"
                chargedUsd={totalChargedUsd}
                headline={result.summary?.headline ?? "Agent signal complete"}
                detail={result.summary?.detail}
                execution={result.execution}
                receiptHref={result.receiptHref}
                commandBarMode
                registerCommand
              />
            </div>
          )}

          {result.ok && !signalExecutionFailed(result.execution) && chainSteps.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Chained sub-signals
              </p>
              <ul className="mt-1 space-y-1">
                {chainSteps.map((c) => (
                  <li key={c.headline} className="text-[11px] text-resolve-muted">
                    {c.serviceName} · {formatAgentPrice(c.chargedUsd)} · {c.headline}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.ok && !signalExecutionFailed(result.execution) && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Hire sub-agent (cents)
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CHAINED_SIGNALS.map((sig) => {
                  const svc = getAgentSignalService(sig.id);
                  if (!svc) return null;
                  return (
                    <button
                      key={sig.id}
                      type="button"
                      disabled={invoking}
                      onClick={() => void runAgent(sig.id, sig.promptSuffix)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-resolve-muted transition hover:border-resolve-accent/25 hover:text-white disabled:opacity-40"
                    >
                      {sig.label} · {formatAgentPrice(svc.priceUsd)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {result.ok && !signalExecutionFailed(result.execution) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3 text-xs text-resolve-muted">
              <span>
                {result.serviceName} · {formatAgentPrice(totalChargedUsd)}
                {result.meteringMode === "user_arc_prepaid" ? " · Arc prepaid" : ""}
              </span>
              {result.receiptHref && (
                <Link
                  href={result.receiptHref}
                  className="inline-flex items-center gap-1 text-resolve-accent hover:underline"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Ledger receipt
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}

          {onFollowUp && (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                {result.ok && !signalExecutionFailed(result.execution)
                  ? "Continue in Mission"
                  : "Try a different path"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(result.ok && !signalExecutionFailed(result.execution)
                  ? FOLLOW_UP_SUGGESTIONS
                  : FAILURE_FOLLOW_UPS
                ).map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => onFollowUp(s.prompt)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-resolve-muted transition hover:border-resolve-accent/25 hover:text-white"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!result.ok && result.payment?.txHash && chargedUsdDisplay(result.payment.chargedUsd) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100">
              <span>
                USDC charged on Arc (−${result.payment.chargedUsd.toFixed(3)}) but agent failed — funds
                settled on-chain
              </span>
              <ArcTxLink txHash={result.payment.txHash} label="Arc proof" />
            </div>
          )}


          {!result.ok && !result.payment?.txHash && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={invoking}
              onClick={() => void runAgent()}
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
