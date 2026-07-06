"use client";

import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import {
  MISSION_COMPETITIVE_EDGE,
  MISSION_HERO_SUBTITLE,
  MISSION_HERO_TITLE,
  MISSION_JOBS,
  type MissionJobId,
} from "@/lib/mission/mission-lane-copy";

export function MissionCommandHero({
  activeJob,
  onSelectJob,
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
      <DiscoverCapitalCard className="discover-operating-hero" padding={false} hover={false}>
        <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
          <div aria-hidden className="discover-operating-hero__flare" />
          <div className="relative">
            <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.24em]">
              Mission OS
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {MISSION_HERO_TITLE}
            </h1>
            <p className="mt-2 text-sm leading-6 text-resolve-muted">{MISSION_HERO_SUBTITLE}</p>
            <p className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-[11px] font-medium leading-relaxed text-violet-100/95">
              {MISSION_COMPETITIVE_EDGE}
            </p>
          </div>

          <div
            className="relative mt-5 grid gap-2 sm:grid-cols-2"
            role="tablist"
            aria-label="Mission intent"
          >
            {MISSION_JOBS.map((job) => {
              const selected = activeJob === job.id;
              const Icon = job.icon;
              return (
                <button
                  key={job.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={job.who}
                  onClick={() => {
                    onSelectJob?.(job.id);
                    onSubmit(job.prompt);
                  }}
                  className={clsx(
                    "discover-job-tile group text-left",
                    selected && "discover-job-tile--active",
                  )}
                >
                  <span className="discover-job-tile__icon">
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{job.who}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-resolve-muted">
                      {job.surfaces}
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
