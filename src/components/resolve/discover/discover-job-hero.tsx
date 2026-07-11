"use client";

import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import { DISCOVER_JOBS, type DiscoverJobId } from "@/lib/discover/discover-jobs";
import { DISCOVER_HERO_SUBTITLE, DISCOVER_HERO_TITLE } from "@/lib/discover/discover-lane-copy";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { EvidenceNetworkVisual } from "@/components/resolve/visuals/evidence-network";

export function DiscoverJobHero({
  activeJob,
  onSelectJob,
  className,
}: {
  activeJob?: DiscoverJobId | null;
  onSelectJob: (jobId: DiscoverJobId, role: DiscoverRole, scrollTo: string) => void;
  className?: string;
}) {
  return (
    <header className={clsx("discover-on-canvas relative mb-7", className)}>
      <DiscoverCapitalCard className="discover-operating-hero" padding={false} hover={false}>
        <div className="relative overflow-hidden px-5 py-5 sm:px-7 sm:py-6">
          <div aria-hidden className="discover-operating-hero__flare" />
          <div className="relative grid items-center gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
            <div>
            <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.24em]">
              Discover OS
            </p>
            <h1 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {DISCOVER_HERO_TITLE}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-resolve-muted sm:text-[15px]">
              {DISCOVER_HERO_SUBTITLE}
            </p>

            <div className="discover-command-intents relative mt-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Discover intent">
            {DISCOVER_JOBS.map((job) => {
              const selected = activeJob === job.id;
              const Icon = job.icon;
              return (
                <button
                  key={job.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={job.title}
                  onClick={() => onSelectJob(job.id, job.role, job.scrollTo)}
                  className={clsx(
                    "discover-job-tile group",
                    selected && "discover-job-tile--active",
                  )}
                >
                  <span className="discover-job-tile__icon">
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{job.who}</span>
                    <span className="sr-only">
                      {job.surfaces}
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-resolve-muted-dim transition group-hover:translate-x-0.5 group-hover:text-white" />
                </button>
              );
            })}
            </div>
            </div>
            <EvidenceNetworkVisual className="min-h-[250px]" />
          </div>
        </div>
      </DiscoverCapitalCard>
    </header>
  );
}
