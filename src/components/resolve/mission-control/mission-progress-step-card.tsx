"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Circle, Loader2 } from "lucide-react";

const DEFAULT_STEPS = [
  "Objective understood",
  "Wallet and price checked",
  "Gathering evidence",
  "Resolving contributors",
  "Preparing result",
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
  const [takingLonger, setTakingLonger] = useState(false);

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

  useEffect(() => {
    if (!active || complete) {
      setTakingLonger(false);
      return;
    }
    const timer = window.setTimeout(() => setTakingLonger(true), 8000);
    return () => window.clearTimeout(timer);
  }, [active, complete]);

  if (!active) return null;

  const done = Boolean(complete);

  return (
    <article className="mission-execution-progress" aria-live="polite">
      <header>
        {!done ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        <div>
          <p>{title}</p>
          <span>{done ? "Result ready" : `Step ${Math.min(stepIndex + 1, steps.length)} of ${steps.length}`}</span>
        </div>
      </header>
      <ol>
        {steps.map((step, i) => {
          const checked = done || i < stepIndex;
          const current = !done && i === stepIndex;
          return (
            <li key={step} className={clsx(checked && "is-complete", current && "is-current")}>
              {checked ? <Check /> : current ? <span aria-hidden /> : <Circle />}
              {step}
            </li>
          );
        })}
      </ol>
      {takingLonger && !done && (
        <p className="mission-execution-progress__long">
          The provider is still processing. Your Mission remains available while the signal syncs.
        </p>
      )}
    </article>
  );
}

export const AGENT_INVOKE_STEPS = [
  "Objective understood",
  "Wallet and price checked",
  "Gathering evidence",
  "Resolving contributors",
  "Preparing result",
] as const;
