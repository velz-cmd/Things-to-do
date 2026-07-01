"use client";

import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { DISCOVER_JOBS, type DiscoverJobId } from "@/lib/discover/discover-jobs";
import type { DiscoverRole } from "@/lib/discover/role-filters";

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
    <header className={clsx("discover-on-canvas relative mb-10 lg:mb-12", className)}>
      <div aria-hidden className="discover-hero-glow" />

      <div className="relative">
        <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.28em]">
          Discover
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
          <span className="resolve-text-gradient">What do you want to do?</span>
        </h1>
        <p className="discover-subtitle mt-4 max-w-2xl text-sm leading-relaxed sm:text-[15px]">
          Pick a job — we surface the right proof, actions, and rails. One cohesive workspace, no
          essay required.
        </p>
      </div>

      <ul className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DISCOVER_JOBS.map((job) => {
          const Icon = job.icon;
          const selected = activeJob === job.id;
          return (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onSelectJob(job.id, job.role, job.scrollTo)}
                className={clsx(
                  "discover-job-card group flex w-full flex-col text-left",
                  selected && "discover-job-card--selected",
                )}
              >
                <div className="flex items-start gap-3 p-4 pb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-resolve-accent/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <Icon className="h-4 w-4 text-white/90" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[15px] font-semibold leading-snug text-white">
                        {job.title}
                      </span>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-resolve-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-resolve-accent" />
                    </div>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-resolve-calm-periwinkle">
                      {job.who}
                    </p>
                  </div>
                </div>
                <p className="border-t border-white/[0.06] px-4 py-3 text-[11px] leading-relaxed text-resolve-muted">
                  {job.surfaces}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </header>
  );
}
