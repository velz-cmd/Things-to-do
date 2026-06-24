"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import type { TaskStatus } from "@/lib/deputy/types";

const STEPS = [
  { key: "created", label: "Created" },
  { key: "escrowed", label: "Escrowed" },
  { key: "verified", label: "Verified" },
  { key: "settled", label: "Settled" },
] as const;

function stepIndex(status: TaskStatus | string): number {
  if (status === "settled") return 3;
  if (status === "verified" || status === "proof_pending") return 2;
  if (
    [
      "authorized",
      "evidence_gathering",
      "planning",
      "executing",
      "waiting_for_response",
      "retrying",
      "escalated",
      "needs_attention",
    ].includes(status)
  ) {
    return 1;
  }
  if (status === "failed" || status === "refunded" || status === "cancelled") return -1;
  return 0;
}

export function MissionStepper({ status }: { status: string }) {
  const current = stepIndex(status);
  const failed = ["failed", "refunded", "cancelled"].includes(status);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done = !failed && current > i;
        const active = !failed && current === i;
        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={clsx(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-medium transition",
                  done && "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
                  active && "border-resolve-accent bg-resolve-accent-muted text-blue-300",
                  !done && !active && "border-resolve-border-strong bg-resolve-bg text-resolve-muted-dim"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={clsx(
                  "text-[10px] font-medium uppercase tracking-wide",
                  active ? "text-white" : "text-resolve-muted-dim"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={clsx(
                  "mx-1 mb-5 h-px flex-1",
                  done ? "bg-emerald-500/40" : "bg-resolve-border-strong"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
