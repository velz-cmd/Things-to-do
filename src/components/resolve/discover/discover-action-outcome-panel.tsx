"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import type { DiscoverOutcomeStep } from "@/lib/discover/discover-action-outcomes";
import { Button } from "@/components/resolve/ui/button";

type DiscoverActionOutcomePanelProps = {
  title: string;
  summary: string;
  steps: DiscoverOutcomeStep[];
  onDeployArc?: () => void;
  deploying?: boolean;
  deployLabel?: string;
  onDone?: () => void;
};

export function DiscoverActionOutcomePanel({
  title,
  summary,
  steps,
  onDeployArc,
  deploying,
  deployLabel = "Settle authorizations on Arc",
  onDone,
}: DiscoverActionOutcomePanelProps) {
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/90">{summary}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
          Where to go next
        </p>
        <ul className="mt-2 space-y-2">
          {steps.map((step) => (
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
                  <span className="mt-0.5 block text-[10px] text-resolve-muted">{step.description}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-resolve-accent" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onDeployArc && (
          <Button type="button" size="sm" variant="secondary" disabled={deploying} onClick={onDeployArc}>
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
