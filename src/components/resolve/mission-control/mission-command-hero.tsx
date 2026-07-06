"use client";

import clsx from "clsx";
import { ArrowRight, CircleDollarSign, Bot, LineChart, Sparkles } from "lucide-react";
import {
  MISSION_HERO_SUBTITLE,
  MISSION_HERO_TITLE,
  type MissionJobId,
} from "@/lib/mission/mission-lane-copy";
import { MissionPipelineStepper } from "@/components/resolve/mission-control/mission-pipeline-stepper";

const PRIMARY_INTENTS = [
  {
    id: "fund" as const satisfies MissionJobId,
    label: "Settle batch",
    detail: "Blueprint · simulate · authorize",
    prompt: "Prepare royalty settlement for independent music artists — show play-weighted payees.",
    icon: LineChart,
    tone: "sky",
  },
  {
    id: "agent" as const satisfies MissionJobId,
    label: "Hire intel",
    detail: "Micropay signal → report",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    icon: Bot,
    tone: "violet",
  },
  {
    id: "simulate" as const satisfies MissionJobId,
    label: "Batch payout",
    detail: "PDF memo → % split",
    prompt: "Batch payout from PDF — allocate $5,000 split between maintainers with percentages",
    icon: CircleDollarSign,
    tone: "emerald",
  },
] as const;

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
    <header className={clsx("mission-on-canvas", className)}>
      <div className="mission-hero-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="mission-eyebrow">
              <Sparkles className="inline h-3.5 w-3.5 text-violet-300" aria-hidden />
              Mission workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
              {MISSION_HERO_TITLE}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-resolve-muted">
              {MISSION_HERO_SUBTITLE}
            </p>
          </div>
          <MissionPipelineStepper activeStep="signal" className="shrink-0" />
        </div>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-3" role="list" aria-label="Start a mission">
          {PRIMARY_INTENTS.map((intent) => {
            const Icon = intent.icon;
            return (
              <button
                key={intent.id}
                type="button"
                role="listitem"
                onClick={() => onSubmit(intent.prompt)}
                className={clsx("mission-intent-card group", `mission-intent-card--${intent.tone}`)}
              >
                <span className="mission-intent-card__icon">
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-white">{intent.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-resolve-muted">
                    {intent.detail}
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
