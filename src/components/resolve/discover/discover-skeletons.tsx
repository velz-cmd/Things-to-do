import { Skeleton } from "@/components/resolve/ui/skeleton";
import styles from "./discover-workspace.module.css";

export function DiscoverTrendingSkeleton() {
  return (
    <div className={styles.opportunityList} aria-busy="true" aria-label="Loading opportunities">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={styles.skeletonRecord}>
          <div className="grid gap-5 lg:grid-cols-[1.35fr_.72fr_.54fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-5 w-56" /></div>
              <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" />
            </div>
            <div className="space-y-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-8 w-32" /><Skeleton className="h-3 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-10 w-full rounded-lg" /><Skeleton className="h-10 w-full rounded-lg" /></div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4 border-y border-white/[0.06] py-3">
            {Array.from({ length: 4 }).map((__, metric) => <Skeleton key={metric} className="h-8 w-full" />)}
          </div>
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DiscoverFeedSkeleton() {
  return (
    <ul
      className="divide-y divide-resolve-border/50 rounded-2xl border border-resolve-border/60 bg-resolve-bg-deep/25"
      aria-busy="true"
      aria-label="Loading live feed"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="px-4 py-3.5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DiscoverFundingSkeleton() {
  return (
    <div className={styles.fundingQueue} aria-busy="true" aria-label="Loading ready-to-fund programs">
      <div className={styles.fundingQueueHeader} aria-hidden="true">
        <span>Program</span><span>Required</span><span>Funded</span><span>Readiness</span><span>Action</span>
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={styles.fundingRecord}>
          <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-xl" /><Skeleton className="h-4 w-40" /></div>
          <Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function DiscoverBubblemapSkeleton() {
  return (
    <div
      className="relative mx-auto aspect-[720/420] w-full max-w-full overflow-hidden rounded-lg bg-resolve-bg-deep/20"
      aria-busy="true"
      aria-label="Loading value bubblemap"
    >
      <Skeleton className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (2 * Math.PI * i) / 6;
        const x = 50 + Math.cos(angle) * 28;
        const y = 50 + Math.sin(angle) * 28;
        return (
          <div
            key={i}
            className="absolute"
            style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
          >
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        );
      })}
    </div>
  );
}
