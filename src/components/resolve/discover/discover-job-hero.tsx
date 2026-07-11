"use client";

import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import { DISCOVER_JOBS, type DiscoverJobId } from "@/lib/discover/discover-jobs";
import { DISCOVER_HERO_SUBTITLE, DISCOVER_HERO_TITLE } from "@/lib/discover/discover-lane-copy";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { EvidenceNetworkVisual } from "@/components/resolve/visuals/evidence-network";
import { DiscoverGlobalSearch } from "@/components/resolve/discover/discover-global-search";

export function DiscoverJobHero({
  activeJob,
  onSelectJob,
  className,
  signedIn,
  query,
  onQueryChange,
}: {
  activeJob?: DiscoverJobId | null;
  onSelectJob: (jobId: DiscoverJobId, role: DiscoverRole, scrollTo: string) => void;
  className?: string;
  signedIn: boolean;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <header className={clsx("discover-on-canvas relative mb-5", className)}>
      <DiscoverCapitalCard className="discover-operating-hero" padding={false} hover={false}>
        <div className="relative overflow-visible px-4 py-4 sm:px-6 sm:py-5 lg:px-7">
          <div aria-hidden className="discover-operating-hero__flare" />
          <div className="relative grid items-start gap-5 lg:grid-cols-[minmax(0,1.16fr)_minmax(430px,.94fr)] xl:gap-6">
            <div className="min-w-0">
              <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.24em]">
                Discover OS
              </p>
              <h1 className="mt-2.5 max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {DISCOVER_HERO_TITLE}
              </h1>
              <p className="mt-2.5 max-w-3xl text-sm leading-6 text-resolve-muted sm:text-[15px]">
                {DISCOVER_HERO_SUBTITLE}
              </p>

              <div className="relative mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="tablist" aria-label="Discover intent">
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
                        `discover-job-tile--${job.id}`,
                        selected && "discover-job-tile--active",
                      )}
                    >
                      <span className="discover-job-tile__icon">
                        <Icon className="h-4 w-4" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{job.who}</span>
                        <span className="mt-1 block text-left text-[11px] leading-4 text-resolve-muted">
                          {job.surfaces}
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-resolve-muted-dim transition group-hover:translate-x-0.5 group-hover:text-white" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="discover-hero-visual-column min-w-0">
              <DiscoverGlobalSearch signedIn={signedIn} query={query} onQueryChange={onQueryChange} />
              <EvidenceNetworkVisual className="mt-2 min-h-[250px]" />
            </div>
          </div>
        </div>
      </DiscoverCapitalCard>
    </header>
  );
}
