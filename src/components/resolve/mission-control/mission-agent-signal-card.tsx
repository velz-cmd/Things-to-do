"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  Receipt,
  Sparkles,
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
import { apiFetchWallet } from "@/lib/discover/discover-action-engine";
import {
  getMissionAgentBudgetCap,
  setMissionAgentBudgetCap,
} from "@/lib/mission/mission-agent-budget";
import { getAgentSignalService } from "@/lib/agent/service-registry";

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
  const signedIn = Boolean(user);

  const [catalog, setCatalog] = useState<ServicesPayload | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [serviceId, setServiceId] = useState(initialServiceId ?? "");
  const [budgetUsd, setBudgetUsd] = useState(0.05);
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
  const autoRunRef = useRef(false);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const res = await fetch("/api/agent/services");
      const data = (await res.json()) as ServicesPayload;
      setCatalog(data);
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

  const alternatives = useMemo(() => {
    if (!catalog?.services || !selected) return [];
    return catalog.services.filter((s) => s.id !== selected.id).slice(0, 4);
  }, [catalog?.services, selected]);

  const pricePreview = selected?.priceUsd ?? 0.001;
  const canAfford = walletUsd == null || walletUsd >= pricePreview;

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
    setInvoking(true);
    setInvokeStage("charging");
    if (!chainLabel) setResult(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 110_000);
    try {
      const res = await fetch("/api/agent/invoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          serviceId: runServiceId,
          prompt: chainLabel ? `${prompt.trim()} — ${chainLabel}` : prompt.trim(),
          text: chainLabel ? `${prompt.trim()} — ${chainLabel}` : prompt.trim(),
          maxSpendUsd: Math.min(budgetUsd, agentCapUsd),
        }),
      });
      setInvokeStage("running");
      const data = (await res.json()) as InvokeResult;
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
        toast.error("Agent invoke timed out", {
          description:
            "Arc USDC transfers can take up to ~60s. Check Arcscan on your wallet — if charged, refresh and view the report.",
        });
      } else {
        toast.error("Could not run agent task");
      }
    } finally {
      window.clearTimeout(timeout);
      setInvoking(false);
      setInvokeStage("idle");
    }
  }

  useEffect(() => {
    if (payDecision !== "pay" || result || invoking || autoRunRef.current) return;
    if (!signedIn) {
      openSignIn();
      return;
    }
    if (!serviceId) return;
    autoRunRef.current = true;
    void runAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payDecision, signedIn, serviceId]);

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
    <div className="space-y-4">
      <p className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2.5 text-center text-xs font-medium leading-relaxed text-violet-100/95">
        {catalog?.tagline ?? MISSION_AGENT_LANE_COPY.tagline}
      </p>

      {!result && selected && payDecision === "pending" && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-3">
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => setPayDecision("pay")}>
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
      )}

      {!result && selected && payDecision === "pay" && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin text-resolve-accent" />
          {invoking
            ? invokeStage === "charging"
              ? "Charging USDC on Arc…"
              : "Running agent — Blueprint loads next"
            : "Preparing agent run…"}
        </div>
      )}

      {result && (
        <div
          className={clsx(
            "rounded-xl border px-4 py-4",
            result.ok
              ? "border-emerald-500/20 bg-emerald-500/[0.04]"
              : "border-rose-500/20 bg-rose-500/[0.04]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={clsx(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  result.ok ? "text-emerald-400/90" : "text-rose-400/90",
                )}
              >
                {result.ok ? "Agent execution report" : "Invoke failed"}
              </p>
              <p className="mt-2 text-base font-medium text-white">
                {result.ok
                  ? (result.summary?.headline ?? "Complete")
                  : (result.error ?? "Could not complete agent signal")}
              </p>
              {result.ok && result.summary?.detail && (
                <p className="mt-1 text-sm text-resolve-muted">{result.summary.detail}</p>
              )}
            </div>
            {result.ok && <Sparkles className="h-5 w-5 shrink-0 text-emerald-400" />}
          </div>

          {result.ok && (result.payment ?? result.wallet) && (
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

          {result.ok && result.execution && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.execution.steps.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    What the agent did
                  </p>
                  <ol className="mt-2 space-y-1">
                    {result.execution.steps.map((step, i) => (
                      <li key={step} className="flex gap-2 text-[11px] text-resolve-muted">
                        <span className="shrink-0 font-mono text-resolve-accent">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {result.execution.findings.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    Findings
                  </p>
                  <ul className="mt-2 space-y-1">
                    {result.execution.findings.map((f) => (
                      <li key={f} className="text-[11px] text-white/90">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.execution.recommendations.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    Recommended next steps
                  </p>
                  <ul className="mt-2 space-y-1">
                    {result.execution.recommendations.map((r) => (
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

          {result.ok && (
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

          {result.ok && chainSteps.length > 0 && (
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

          {result.ok && (
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

          {result.ok && (
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

          {result.ok && onFollowUp && (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Continue in Mission
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FOLLOW_UP_SUGGESTIONS.map((s) => (
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

          {!result.ok && result.payment?.txHash && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100">
              <span>
                USDC charged on Arc (−${result.payment.chargedUsd.toFixed(3)}) but agent failed — funds
                settled on-chain
              </span>
              <ArcTxLink txHash={result.payment.txHash} label="Arc proof" />
            </div>
          )}

          {!result.ok && (
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
