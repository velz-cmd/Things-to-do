"use client";

import clsx from "clsx";
import { ArrowRight, CircleDollarSign, Bot, LineChart } from "lucide-react";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
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
  },
  {
    id: "simulate" as const satisfies MissionJobId,
    label: "Batch payout",
    detail: "PDF → % split → Arc batch",
    prompt: "Batch payout from PDF — allocate $5,000 split between maintainers with percentages",
    icon: LineChart,
  },
  {
    id: "agent" as const satisfies MissionJobId,
    label: "Hire intel",
    detail: "x402 signal → Blueprint",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    icon: Bot,
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
    <header className={clsx("discover-on-canvas relative", className)}>
      <DiscoverCapitalCard className="discover-operating-hero" padding={false} hover={false}>
        <div className="relative overflow-hidden px-5 py-5 sm:px-7 sm:py-6">
          <div aria-hidden className="discover-operating-hero__flare" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.24em]">
                Mission OS
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {MISSION_HERO_TITLE}
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-resolve-muted sm:text-[15px]">
                {MISSION_HERO_SUBTITLE}
              </p>
            </div>
            <MissionPipelineStepper activeStep="signal" className="shrink-0" />
          </div>

          <div
            className="relative mt-5 grid gap-2 sm:grid-cols-3"
            role="list"
            aria-label="Start a mission"
          >
            {PRIMARY_INTENTS.map((intent) => {
              const Icon = intent.icon;
              return (
                <button
                  key={intent.id}
                  type="button"
                  role="listitem"
                  onClick={() => onSubmit(intent.prompt)}
                  className="discover-job-tile group"
                >
                  <span className="discover-job-tile__icon">
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{intent.label}</span>
                    <span className="mt-0.5 block text-left text-[11px] leading-4 text-resolve-muted">
                      {intent.detail}
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-resolve-muted-dim transition group-hover:translate-x-0.5 group-hover:text-white" />
                </button>
              );
            })}
          </div>
        </div>
      </DiscoverCapitalCard>
    </header>
  );
}
