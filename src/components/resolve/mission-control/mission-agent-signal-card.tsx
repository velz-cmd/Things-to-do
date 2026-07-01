"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
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
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";
import { matchServiceForPrompt } from "@/lib/agent/commerce-match";
import { PLATFORM_LOOP_TAGLINE } from "@/lib/economy/platform-loop";
import { apiFetchWallet } from "@/lib/discover/discover-action-engine";

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
  wallet?: {
    chargedUsd: number;
    balanceUsd: number;
    previousBalanceUsd: number;
  };
  walletError?: string;
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
  const [walletUsd, setWalletUsd] = useState<number | null>(null);
  const [invoking, setInvoking] = useState(false);
  const [result, setResult] = useState<InvokeResult | null>(null);

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
    void apiFetchWallet().then((w) => setWalletUsd(w.spendableUsd));
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

  async function runAgent() {
    if (!signedIn) {
      openSignIn();
      return;
    }
    if (!prompt.trim() || !serviceId) {
      toast.error("Enter a prompt and pick a service");
      return;
    }
    setInvoking(true);
    setResult(null);
    try {
      const res = await fetch("/api/agent/invoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          prompt: prompt.trim(),
          text: prompt.trim(),
          maxSpendUsd: budgetUsd,
        }),
      });
      const data = (await res.json()) as InvokeResult;
      setResult(data);
      if (data.wallet?.balanceUsd != null) {
        setWalletUsd(data.wallet.balanceUsd);
      } else if (signedIn) {
        const w = await apiFetchWallet();
        setWalletUsd(w.spendableUsd);
      }
      if (data.ok) {
        toast.success(data.summary?.headline ?? "Agent signal complete", {
          description: data.wallet
            ? `${formatAgentPrice(data.wallet.chargedUsd)} charged · ${formatAgentPrice(data.wallet.balanceUsd)} remaining`
            : undefined,
        });
      } else {
        toast.error(data.walletError ?? data.error ?? "Agent invoke failed");
      }
    } catch {
      toast.error("Could not run agent task");
    } finally {
      setInvoking(false);
    }
  }

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
        {catalog?.tagline ?? PLATFORM_LOOP_TAGLINE}
      </p>

      {!result && selected && (
        <>
          <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
              What you get
            </p>
            <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{selected.description}</p>
            <ul className="mt-2 space-y-1">
              {(selected.deliverables ?? [selected.tagline]).map((d) => (
                <li key={d} className="flex items-start gap-2 text-[11px] text-white/85">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-resolve-accent" />
                  {d}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">
              Suggested service
            </span>
            <span className="rounded-full border border-resolve-accent/30 bg-resolve-accent/[0.08] px-2.5 py-1 text-xs font-medium text-white">
              {selected.name} · {formatAgentPrice(selected.priceUsd)}/{selected.billingUnit}
            </span>
          </div>

          {alternatives.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">
                Other signals
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {alternatives.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-resolve-muted transition hover:border-resolve-accent/25 hover:text-white"
                  >
                    {s.name} · {formatAgentPrice(s.priceUsd)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-resolve-muted">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-3.5 w-3.5 shrink-0" />
              <span>
                Price preview:{" "}
                <span className="font-semibold text-emerald-300">{formatAgentPrice(pricePreview)}</span>
              </span>
            </div>
            {signedIn && walletUsd != null && (
              <p className="mt-1.5">
                Wallet:{" "}
                <span
                  className={clsx(
                    "font-semibold tabular-nums",
                    canAfford ? "text-emerald-300" : "text-amber-200",
                  )}
                >
                  ${walletUsd.toFixed(2)} available
                </span>
                {" · "}
                This run charges{" "}
                <span className="font-medium text-white">{formatAgentPrice(pricePreview)}</span>
                {!canAfford && (
                  <span className="ml-1">
                    —{" "}
                    <Link href="/payments" className="text-resolve-accent hover:underline">
                      add funds
                    </Link>
                  </span>
                )}
              </p>
            )}
            {catalog?.feePath && (
              <p className="mt-1.5 text-[10px] text-resolve-muted-dim">
                Platform fee: {catalog.feePath.platformFeeBps / 100}% on settlements · sample{" "}
                {formatAgentPrice(catalog.feePath.platformFeeUsd)} on {formatAgentPrice(pricePreview)}{" "}
                signal
              </p>
            )}
          </div>

          <Button
            className="gap-2"
            disabled={invoking || (signedIn && walletUsd != null && !canAfford)}
            onClick={() => void runAgent()}
          >
            {invoking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
            Run agent · {formatAgentPrice(pricePreview)}
          </Button>
        </>
      )}

      {result && (
        <div
          className={clsx(
            "rounded-xl border px-4 py-4",
            result.ok ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-rose-500/20 bg-rose-500/[0.04]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
                {result.ok ? "Agent execution report" : "Invoke failed"}
              </p>
              <p className="mt-2 text-base font-medium text-white">
                {result.summary?.headline ?? result.error ?? "No summary"}
              </p>
              {result.summary?.detail && (
                <p className="mt-1 text-sm text-resolve-muted">{result.summary.detail}</p>
              )}
            </div>
            {result.ok && <Sparkles className="h-5 w-5 shrink-0 text-emerald-400" />}
          </div>

          {result.ok && result.wallet && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-100">
              <span className="font-semibold tabular-nums">
                −${result.wallet.chargedUsd.toFixed(3)}
              </span>{" "}
              charged · was ${result.wallet.previousBalanceUsd.toFixed(2)} → now{" "}
              <span className="font-semibold tabular-nums">
                ${result.wallet.balanceUsd.toFixed(2)}
              </span>
            </div>
          )}
          {result.walletError && (
            <p className="mt-2 text-xs text-amber-200">{result.walletError}</p>
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
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3 text-xs text-resolve-muted">
              <span>
                {result.serviceName} · {formatAgentPrice(result.amountUsd ?? 0)}
              </span>
              {result.receiptHref && (
                <Link
                  href={result.receiptHref}
                  className="inline-flex items-center gap-1 text-resolve-accent hover:underline"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  View receipt
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
