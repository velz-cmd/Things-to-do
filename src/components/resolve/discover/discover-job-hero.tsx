"use client";

import clsx from "clsx";
import { ArrowRight } from "lucide-react";
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
    <div className={clsx("discover-on-canvas mb-8", className)}>
      <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.22em]">
        Discover
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        What do you want to do?
      </h1>
      <p className="discover-subtitle mt-2 max-w-2xl text-sm">
        Pick a job — we surface the right proof, actions, and rails. No essays required.
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DISCOVER_JOBS.map((job) => {
          const Icon = job.icon;
          const selected = activeJob === job.id;
          return (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onSelectJob(job.id, job.role, job.scrollTo)}
                className={clsx(
                  "resolve-signal-service-card group flex w-full flex-col overflow-hidden rounded-2xl text-left transition",
                  selected
                    ? "ring-1 ring-resolve-calm-periwinkle/40"
                    : "resolve-card-hover",
                )}
              >
                <div className="resolve-silver-strip resolve-silver-strip--headline flex items-center gap-2.5 px-3.5 py-3">
                  <div className="resolve-signal-row-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="h-3.5 w-3.5 text-white/90" strokeWidth={1.75} />
                  </div>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-white">{job.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white/75" />
                </div>
                <div className="px-3.5 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-calm-periwinkle/90">
                    {job.who}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-white/55">{job.surfaces}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
