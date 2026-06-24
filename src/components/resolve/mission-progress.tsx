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
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-resolve-muted">Progress</p>
          <p className="text-2xl font-semibold tabular-nums text-white">{pct}%</p>
        </div>
        {label && (
          <p className="text-right text-sm text-resolve-muted">{label}</p>
        )}
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className={clsx(
            "absolute inset-y-0 left-0 rounded-full bg-resolve-accent transition-all duration-200 ease-out",
            status === "needs_attention" && "from-amber-500 to-amber-400",
            status === "settled" && "from-emerald-500 to-emerald-400",
            status === "failed" && "from-red-500 to-red-400",
            isRunning && "animate-pulse"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-center">
        <div className="relative h-20 w-20">
          <svg className="-rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={
                status === "settled"
                  ? "#34d399"
                  : status === "needs_attention"
                    ? "#fbbf24"
                    : status === "failed"
                      ? "#f87171"
                      : "url(#missionGrad)"
              }
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${pct * 2.64} 264`}
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="missionGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
            {pct}%
          </div>
        </div>
      </div>
    </div>
  );
}
