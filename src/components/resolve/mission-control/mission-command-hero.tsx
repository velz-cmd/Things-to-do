"use client";

import clsx from "clsx";
import { CircleDollarSign, Bot, LineChart } from "lucide-react";
import {
  MISSION_HERO_SUBTITLE,
  MISSION_HERO_TITLE,
  type MissionJobId,
} from "@/lib/mission/mission-lane-copy";
import { MissionPipelineStepper } from "@/components/resolve/mission-control/mission-pipeline-stepper";

const PRIMARY_INTENTS = [
  {
    id: "fund" as const satisfies MissionJobId,
    label: "Communal pool",
    detail: "View milestone · fund on Discover",
    prompt: "View React communal pool — milestone and autopay status",
    icon: CircleDollarSign,
    accent: "sky",
  },
  {
    id: "simulate" as const satisfies MissionJobId,
    label: "Batch payout",
    detail: "PDF → % split → Arc batch",
    prompt: "Batch payout from PDF — allocate $5,000 split between maintainers with percentages",
    icon: LineChart,
    accent: "emerald",
  },
  {
    id: "agent" as const satisfies MissionJobId,
    label: "Hire intel",
    detail: "x402 signal → Blueprint",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    icon: Bot,
    accent: "violet",
  },
] as const;

const accentRing: Record<string, string> = {
  sky: "hover:border-sky-500/35 hover:bg-sky-500/[0.06] focus-visible:ring-sky-500/40",
  emerald: "hover:border-emerald-500/35 hover:bg-emerald-500/[0.06] focus-visible:ring-emerald-500/40",
  violet: "hover:border-violet-500/35 hover:bg-violet-500/[0.06] focus-visible:ring-violet-500/40",
};

export function MissionCommandHero({
  onSubmit,
  className,
}: {
  activeJob?: MissionJobId | null;
  onSelectJob?: (jobId: MissionJobId) => void;
  onSubmit: (prompt: string) => void;
  className?: string;
}) {
  return (
    <header className={clsx("relative", className)}>
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0f1729] to-[#0a1020]/80 px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">
              Mission
            </p>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {MISSION_HERO_TITLE}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-resolve-muted">
              {MISSION_HERO_SUBTITLE}
            </p>
          </div>
          <MissionPipelineStepper activeStep="signal" className="shrink-0" />
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3" role="list" aria-label="Start a mission">
          {PRIMARY_INTENTS.map((intent) => {
            const Icon = intent.icon;
            return (
              <button
                key={intent.id}
                type="button"
                role="listitem"
                onClick={() => onSubmit(intent.prompt)}
                className={clsx(
                  "group flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2",
                  accentRing[intent.accent],
                )}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/90">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{intent.label}</span>
                  <span className="mt-0.5 block text-[11px] text-resolve-muted">{intent.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
