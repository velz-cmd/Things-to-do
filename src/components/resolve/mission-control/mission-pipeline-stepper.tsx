"use client";

import clsx from "clsx";
import { Check } from "lucide-react";

const STEPS = [
  { id: "signal", label: "Signal" },
  { id: "blueprint", label: "Blueprint" },
  { id: "simulate", label: "Simulate" },
  { id: "authorize", label: "Authorize" },
] as const;

export type MissionPipelineStep = (typeof STEPS)[number]["id"];

export function MissionPipelineStepper({
  activeStep = "blueprint",
  simulated = false,
  className,
}: {
  activeStep?: MissionPipelineStep;
  simulated?: boolean;
  className?: string;
}) {
  const activeIndex = STEPS.findIndex((s) => s.id === activeStep);

  function stepState(index: number): "done" | "active" | "upcoming" {
    if (index < activeIndex) return "done";
    if (index === activeIndex) return "active";
    if (simulated && STEPS[index].id === "simulate") return "done";
    if (simulated && STEPS[index].id === "authorize") return "active";
    return "upcoming";
  }

  return (
    <nav
      aria-label="Mission decision loop"
      className={clsx("flex items-center gap-1 sm:gap-2", className)}
    >
      {STEPS.map((step, i) => {
        const state = stepState(i);
        const isLast = i === STEPS.length - 1;
        return (
          <div key={step.id} className="flex min-w-0 items-center gap-1 sm:gap-2">
            <div
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition",
                state === "active" && "bg-sky-500/15 text-sky-100 ring-1 ring-sky-400/30",
                state === "done" && "text-emerald-300/90",
                state === "upcoming" && "text-resolve-muted-dim",
              )}
            >
              {state === "done" ? (
                <Check className="h-3 w-3 shrink-0" aria-hidden />
              ) : (
                <span
                  className={clsx(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    state === "active"
                      ? "bg-sky-500/30 text-sky-100"
                      : "bg-white/[0.06] text-resolve-muted-dim",
                  )}
                >
                  {i + 1}
                </span>
              )}
              <span className="hidden truncate sm:inline">{step.label}</span>
            </div>
            {!isLast && (
              <span
                className={clsx(
                  "h-px w-3 sm:w-6",
                  state === "done" ? "bg-emerald-500/40" : "bg-white/[0.08]",
                )}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
