"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Loader2 } from "lucide-react";

const DEFAULT_STEPS = [
  "Searching ecosystem",
  "Mapping dependencies",
  "Finding maintainers",
  "Detecting funding gaps",
  "Building allocation",
] as const;

export function MissionThinking({
  active,
  complete,
  steps = DEFAULT_STEPS,
}: {
  active: boolean;
  complete: boolean;
  steps?: readonly string[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setExpanded(true);
      return;
    }

    const timers = steps.map((_, i) =>
      setTimeout(() => setStepIndex(i), i * 520),
    );

    return () => timers.forEach(clearTimeout);
  }, [active, steps]);

  useEffect(() => {
    if (complete && active) {
      setStepIndex(steps.length - 1);
      const t = setTimeout(() => setExpanded(false), 600);
      return () => clearTimeout(t);
    }
  }, [complete, active, steps.length]);

  if (!active) return null;

  const done = complete;
  const label = done ? "Thought for a few seconds" : "Thinking…";

  return (
    <div className="rounded-xl border border-resolve-border/50 bg-resolve-bg-deep/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-resolve-muted transition hover:text-white"
      >
        {!done && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-resolve-accent" />}
        <span>{label}</span>
        <ChevronDown
          className={clsx("ml-auto h-4 w-4 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <ul className="space-y-1.5 border-t border-resolve-border/40 px-4 py-3">
          {steps.map((step, i) => {
            const checked = done || i < stepIndex;
            const current = !done && i === stepIndex;
            return (
              <li
                key={step}
                className={clsx(
                  "flex items-center gap-2 text-xs transition",
                  checked ? "text-emerald-300/90" : current ? "text-white/90" : "text-resolve-muted-dim",
                )}
              >
                {checked ?
                  <Check className="h-3 w-3 shrink-0" />
                : <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/20" />}
                {step}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
