"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, Wallet, X } from "lucide-react";
import type { DiscoverOutcomeStep } from "@/lib/discover/discover-action-outcomes";
import { Button } from "@/components/resolve/ui/button";

type DiscoverActionOutcomePanelProps = {
  title: string;
  summary: string;
  steps: DiscoverOutcomeStep[];
  amountUsd?: number;
  programName?: string;
  communitySlug?: string;
  whoBenefits?: string;
  whyFund?: string;
  variant?: "fund" | "default";
  onDeployArc?: () => void;
  deploying?: boolean;
  deployLabel?: string;
  onDone?: () => void;
  onClose?: () => void;
};

export function DiscoverActionOutcomePanel({
  title,
  summary,
  steps,
  amountUsd,
  programName,
  communitySlug,
  whoBenefits,
  whyFund,
  variant = "default",
  onDeployArc,
  deploying,
  deployLabel = "Settle authorizations on Arc",
  onDone,
  onClose,
}: DiscoverActionOutcomePanelProps) {
  const dismiss = onClose ?? onDone;
  const primary = steps.find((s) => s.primary) ?? steps[0];
  const secondary = steps.filter((s) => s !== primary);

  return (
    <div className="space-y-4" data-testid="action-outcome-panel">
      <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.12] to-emerald-500/[0.04] px-4 py-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-semibold leading-snug text-white">{title}</p>
              {dismiss && (
                <button
                  type="button"
                  onClick={dismiss}
                  className="shrink-0 rounded-md p-1 text-resolve-muted transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-100/95">{summary}</p>
          </div>
        </div>

        {variant === "fund" && (programName || communitySlug || amountUsd != null) && (
          <dl className="mt-4 grid gap-2 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-3 text-[11px]">
            {amountUsd != null && (
              <div className="flex justify-between gap-3">
                <dt className="text-resolve-muted">You sent</dt>
                <dd className="font-semibold tabular-nums text-white">
                  ${amountUsd.toFixed(2)} USDC
                </dd>
              </div>
            )}
            {programName && (
              <div className="flex justify-between gap-3">
                <dt className="text-resolve-muted">Program</dt>
                <dd className="text-right font-medium text-white">{programName}</dd>
              </div>
            )}
            {communitySlug && (
              <div className="flex justify-between gap-3">
                <dt className="text-resolve-muted">Community</dt>
                <dd className="capitalize text-white">{communitySlug.replace(/-/g, " ")}</dd>
              </div>
            )}
          </dl>
        )}

        {variant === "fund" && (whoBenefits || whyFund) && (
          <div className="mt-3 space-y-2 border-t border-emerald-500/20 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80">
              How this helps
            </p>
            {whoBenefits && (
              <p className="text-xs leading-relaxed text-white/90">
                <span className="text-resolve-muted">Who benefits · </span>
                {whoBenefits}
              </p>
            )}
            {whyFund && whoBenefits !== whyFund && (
              <p className="text-[11px] leading-relaxed text-resolve-muted">{whyFund}</p>
            )}
          </div>
        )}
      </div>

      {primary && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
            {variant === "fund" ? "See where it went" : "What to do next"}
          </p>
          <Link
            href={primary.href}
            target={primary.external ? "_blank" : undefined}
            rel={primary.external ? "noopener noreferrer" : undefined}
            className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-resolve-accent/35 bg-resolve-accent/10 px-4 py-3.5 text-left transition hover:border-resolve-accent/50 hover:bg-resolve-accent/15"
          >
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4 shrink-0 text-resolve-accent" />
              <span>
                <span className="block text-sm font-semibold text-white">{primary.label}</span>
                <span className="mt-0.5 block text-[11px] text-resolve-muted">
                  {primary.description}
                </span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-resolve-accent" />
          </Link>
        </div>
      )}

      {secondary.length > 0 && (
        <ul className="space-y-2">
          {secondary.map((step) => (
            <li key={step.id}>
              <Link
                href={step.href}
                target={step.external ? "_blank" : undefined}
                rel={step.external ? "noopener noreferrer" : undefined}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2.5 text-left transition hover:border-white/15"
              >
                <span>
                  <span className="flex items-center gap-1 text-xs font-medium text-white">
                    {step.label}
                    {step.external && <ExternalLink className="h-3 w-3 text-resolve-muted" />}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-resolve-muted">
                    {step.description}
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-resolve-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-3">
        {onDeployArc && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-resolve-muted"
            disabled={deploying}
            onClick={onDeployArc}
          >
            {deploying ? "Settling…" : deployLabel}
          </Button>
        )}
        {onDone && (
          <Button type="button" size="sm" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
