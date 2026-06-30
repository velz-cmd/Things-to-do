"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VALUE_FLOW_STAGES } from "@/lib/economy/phases";

type Props = {
  variant?: "full" | "compact";
};

export function ValueFlowPanel({ variant = "full" }: Props) {
  return (
    <section>
      {variant === "full" && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            Value flow
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Seven stages — proof on every step
          </h3>
        </div>
      )}
      <ol className="relative space-y-0">
        {VALUE_FLOW_STAGES.map((stage, i) => (
          <li key={stage.order} className="relative flex gap-4 pb-6 last:pb-0">
            {i < VALUE_FLOW_STAGES.length - 1 && (
              <span
                className="absolute left-[11px] top-6 h-full w-px bg-white/10"
                aria-hidden
              />
            )}
            <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#0a0f18] text-[10px] font-semibold text-resolve-accent">
              {stage.order}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{stage.stage}</p>
                {stage.onChain && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-300">
                    On-chain
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-resolve-muted">{stage.description}</p>
              {variant === "full" && (
                <p className="mt-1 font-mono text-[10px] text-resolve-muted-dim">
                  {stage.apiRoute}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {variant === "full" && (
        <Link
          href="/api/economy/infrastructure"
          className="mt-4 inline-flex items-center gap-1 text-xs text-resolve-accent hover:underline"
        >
          Full infrastructure manifest
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </section>
  );
}
