"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Loader2 } from "lucide-react";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";

const DEFAULT_STEPS = [
  "Understanding your objective",
  "Gathering evidence",
  "Building recommendation",
] as const;

export function MissionProgressStepCard({
  active,
  complete,
  title = "Working on your mission",
  steps = DEFAULT_STEPS,
}: {
  active: boolean;
  complete?: boolean;
  title?: string;
  steps?: readonly string[];
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }

    const timers = steps.map((_, i) => setTimeout(() => setStepIndex(i), i * 120));
    return () => timers.forEach(clearTimeout);
  }, [active, steps]);

  useEffect(() => {
    if (complete && active) setStepIndex(steps.length - 1);
  }, [complete, active, steps.length]);

  if (!active) return null;

  const done = Boolean(complete);

  return (
    <DiscoverCapitalCard accent="violet" className="shadow-lg shadow-black/15">
      <div className="flex items-start gap-3">
        {!done && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-300" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="mt-0.5 text-xs text-resolve-muted">
            {done ? "Almost ready…" : `Step ${Math.min(stepIndex + 1, steps.length)} of ${steps.length}`}
          </p>
          <ol className="mt-3 space-y-2">
            {steps.map((step, i) => {
              const checked = done || i < stepIndex;
              const current = !done && i === stepIndex;
              return (
                <li
                  key={step}
                  className={clsx(
                    "flex items-center gap-2 text-xs transition",
                    checked ? "text-emerald-300/95" : current ? "text-white" : "text-resolve-muted-dim",
                  )}
                >
                  {checked ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : current ? (
                    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                    </span>
                  ) : (
                    <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/15" />
                  )}
                  {step}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </DiscoverCapitalCard>
  );
}

export const AGENT_INVOKE_STEPS = [
  "Confirming wallet and budget",
  "Charging USDC on Arc",
  "Running agent signal",
  "Preparing your report",
] as const;
