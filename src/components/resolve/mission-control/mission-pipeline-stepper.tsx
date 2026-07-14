"use client";

import clsx from "clsx";
import { Check, ReceiptText } from "lucide-react";

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
  paidSignal = false,
  className,
}: {
  activeStep?: MissionPipelineStep;
  simulated?: boolean;
  paidSignal?: boolean;
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
      className={clsx("mission-workflow-rail", className)}
    >
      {STEPS.map((step, i) => {
        const state = stepState(i);
        const isLast = i === STEPS.length - 1;
        return (
          <div key={step.id} className="mission-workflow-step" data-state={state}>
            <div
              className="mission-workflow-step__label"
            >
              {state === "done" ? (
                <Check className="h-3 w-3 shrink-0" aria-hidden />
              ) : (
                <span>{String(i + 1).padStart(2, "0")}</span>
              )}
              <strong>{step.label}</strong>
              {paidSignal && step.id === "signal" && (
                <ReceiptText className="mission-workflow-step__receipt" aria-label="Paid signal receipt recorded" />
              )}
            </div>
            {!isLast && (
              <span className="mission-workflow-step__connector" aria-hidden />
            )}
          </div>
        );
      })}
    </nav>
  );
}
