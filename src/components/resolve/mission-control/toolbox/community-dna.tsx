"use client";

import type { CommunityDna } from "@/lib/mission/toolbox/types";

const DNA_LABELS: { key: keyof CommunityDna; label: string }[] = [
  { key: "health", label: "Health" },
  { key: "velocity", label: "Velocity" },
  { key: "funding", label: "Funding" },
  { key: "busFactor", label: "Bus factor" },
  { key: "research", label: "Research" },
  { key: "community", label: "Community" },
  { key: "risk", label: "Risk" },
];

function barColor(key: keyof CommunityDna, value: number) {
  if (key === "risk") return value > 60 ? "bg-rose-400" : value > 35 ? "bg-amber-400" : "bg-emerald-400";
  return value >= 70 ? "bg-emerald-400" : value >= 45 ? "bg-amber-400" : "bg-rose-400";
}

export function CommunityDnaPanel({ dna, name }: { dna: CommunityDna; name: string }) {
  return (
    <div className="rounded-lg border border-resolve-border/50 bg-resolve-bg-deep/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
        Community DNA
      </p>
      <p className="mt-0.5 truncate text-xs font-medium text-white">{name}</p>
      <ul className="mt-3 space-y-2">
        {DNA_LABELS.map(({ key, label }) => {
          const v = dna[key];
          return (
            <li key={key}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-resolve-muted">{label}</span>
                <span className="tabular-nums text-white/90">{v}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${barColor(key, v)}`}
                  style={{ width: `${v}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
