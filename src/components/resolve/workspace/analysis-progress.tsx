"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

const STEPS = [
  "Reading repository",
  "Reading contributors",
  "Understanding pull requests",
  "Detecting suspicious activity",
  "Measuring real impact",
  "Building settlement plan",
  "Preparing capital allocation",
] as const;

export function AnalysisProgress({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete?: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setDone(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setStepIndex(i);
          if (i === STEPS.length - 1) {
            setDone(true);
            onComplete?.();
          }
        }, i * 520),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [active, onComplete]);

  if (!active) return null;

  const progress = done ? 100 : Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <Panel className="p-5">
      <p className="text-sm font-medium text-white">Analyzing repository…</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-resolve-accent transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {STEPS.map((label, i) => {
          const complete = i < stepIndex || (done && i === stepIndex);
          const current = i === stepIndex && !done;
          return (
            <li
              key={label}
              className={clsx(
                "flex items-center gap-2 text-sm transition",
                complete ? "text-emerald-300" : current ? "text-white" : "text-resolve-muted-dim",
              )}
            >
              {complete ?
                <Check className="h-3.5 w-3.5 shrink-0" />
              : <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" />}
              {label}
              {complete && "…"}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
