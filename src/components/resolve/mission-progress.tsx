"use client";

import { taskProgress } from "@/lib/resolve/progress";
import clsx from "clsx";

export function MissionProgress({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const pct = taskProgress(status);
  const isRunning = !["settled", "failed", "refunded", "cancelled", "needs_attention"].includes(status);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-deputy-muted">Progress</p>
          <p className="text-2xl font-semibold tabular-nums">{pct}%</p>
        </div>
        {label && (
          <p className="text-right text-sm text-deputy-muted">{label}</p>
        )}
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-deputy-bg">
        <div
          className={clsx(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
            status === "needs_attention"
              ? "bg-amber-500"
              : status === "settled"
                ? "bg-emerald-500"
                : status === "failed"
                  ? "bg-red-500"
                  : "bg-blue-500",
            isRunning && "animate-pulse"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-center">
        <div
          className={clsx(
            "relative h-24 w-24 rounded-full border-4 border-deputy-border",
            isRunning && "animate-[spin_8s_linear_infinite]"
          )}
          style={{
            background: `conic-gradient(${
              status === "settled" ? "#10b981" : status === "needs_attention" ? "#f59e0b" : "#3b82f6"
            } ${pct * 3.6}deg, #1a2332 ${pct * 3.6}deg)`,
          }}
        >
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-deputy-panel text-lg font-semibold">
            {pct}%
          </div>
        </div>
      </div>
    </div>
  );
}
